import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { BetStatus, MatchStatus, TxType } from '@prisma/client';
import { OddsService } from '../odds/odds.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WalletService } from '../wallet/wallet.service';

const MIN_STAKE = 10;
const MAX_STAKE_ABS = 50_000;
const LOCK_BEFORE_START_MS = 2 * 60 * 1000;

interface PlaceBetDto {
  matchId: string;
  pickedPlayerId: string;
  stake: number;
}

@Injectable()
export class BetsService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
    private odds: OddsService,
    private realtime: RealtimeGateway,
  ) {}

  async placeBet(userId: string, dto: PlaceBetDto) {
    if (dto.stake < MIN_STAKE || dto.stake > MAX_STAKE_ABS) {
      throw new BadRequestException('STAKE_OUT_OF_BOUNDS');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const matchRows = await tx.$queryRaw<Array<any>>`
          SELECT * FROM "Match" WHERE id = ${dto.matchId} FOR UPDATE
        `;
        const match = matchRows[0];
        if (!match) throw new BadRequestException('MATCH_NOT_FOUND');

        if (match.status !== MatchStatus.OPEN_FOR_BETS) {
          throw new ConflictException('MATCH_NOT_OPEN');
        }
        if (
          new Date(match.startsAt).getTime() - Date.now() <
          LOCK_BEFORE_START_MS
        ) {
          throw new ConflictException('MATCH_STARTED');
        }
        if (![match.playerAId, match.playerBId].includes(dto.pickedPlayerId)) {
          throw new BadRequestException('INVALID_PLAYER');
        }

        const existing = await tx.bet.findFirst({
          where: {
            userId,
            matchId: dto.matchId,
            status: BetStatus.PENDING,
          },
        });
        if (existing) throw new ConflictException('BET_ALREADY_PLACED');

        const isPickA = dto.pickedPlayerId === match.playerAId;
        const oddsAtBet = isPickA ? match.oddsA : match.oddsB;
        const potentialWin = Math.floor(dto.stake * Number(oddsAtBet));

        const bet = await tx.bet.create({
          data: {
            userId,
            matchId: match.id,
            pickedPlayerId: dto.pickedPlayerId,
            stake: dto.stake,
            oddsAtBet,
            potentialWin,
            status: BetStatus.PENDING,
          },
        });

        await this.wallet.applyDelta(
          tx,
          userId,
          -dto.stake,
          TxType.BET_PLACED,
          { betId: bet.id, matchId: match.id },
        );

        const newTotalA = match.totalStakeA + (isPickA ? dto.stake : 0);
        const newTotalB = match.totalStakeB + (isPickA ? 0 : dto.stake);

        const playerA = await tx.player.findUnique({
          where: { id: match.playerAId },
        });
        const playerB = await tx.player.findUnique({
          where: { id: match.playerBId },
        });

        const newOdds = this.odds.recompute({
          seedA: playerA!.seed,
          seedB: playerB!.seed,
          currentOddsA: Number(match.oddsA),
          totalStakeA: newTotalA,
          totalStakeB: newTotalB,
        });

        await tx.match.update({
          where: { id: match.id },
          data: {
            totalStakeA: newTotalA,
            totalStakeB: newTotalB,
            oddsA: newOdds.oddsA,
            oddsB: newOdds.oddsB,
          },
        });

        await tx.oddsSnapshot.create({
          data: {
            matchId: match.id,
            oddsA: newOdds.oddsA,
            oddsB: newOdds.oddsB,
            totalStakeA: newTotalA,
            totalStakeB: newTotalB,
            reason: 'BET_PLACED',
          },
        });

        return {
          bet,
          match: {
            id: match.id,
            oddsA: newOdds.oddsA,
            oddsB: newOdds.oddsB,
          },
        };
      },
      { isolationLevel: 'Serializable' },
    );

    this.realtime.broadcast('match.odds', result.match);
    this.realtime.broadcast('leaderboard.invalidate', {});

    return result.bet;
  }
}
