import { BadRequestException, Injectable } from '@nestjs/common';
import { BetStatus, MatchStatus, TxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AdminMatchesService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
    private realtime: RealtimeGateway,
  ) {}

  async settle(matchId: string, winnerId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const match = await tx.match.findUnique({ where: { id: matchId } });
        if (!match) throw new BadRequestException('MATCH_NOT_FOUND');
        if (![match.playerAId, match.playerBId].includes(winnerId)) {
          throw new BadRequestException('INVALID_WINNER');
        }
        if (
          [MatchStatus.SETTLED, MatchStatus.CANCELLED].includes(match.status)
        ) {
          throw new BadRequestException('MATCH_ALREADY_FINALIZED');
        }

        const bets = await tx.bet.findMany({
          where: { matchId, status: BetStatus.PENDING },
        });

        for (const bet of bets) {
          const won = bet.pickedPlayerId === winnerId;
          if (won) {
            const payout = Math.floor(bet.stake * Number(bet.oddsAtBet));
            await tx.bet.update({
              where: { id: bet.id },
              data: {
                status: BetStatus.WON,
                payout,
                settledAt: new Date(),
              },
            });
            await this.wallet.applyDelta(
              tx,
              bet.userId,
              payout,
              TxType.BET_WON,
              { betId: bet.id, matchId },
            );
          } else {
            await tx.bet.update({
              where: { id: bet.id },
              data: {
                status: BetStatus.LOST,
                payout: 0,
                settledAt: new Date(),
              },
            });
            const user = await tx.user.findUnique({
              where: { id: bet.userId },
            });
            await tx.pointTransaction.create({
              data: {
                userId: bet.userId,
                type: TxType.BET_LOST,
                amount: 0,
                balanceAfter: user!.balance,
                betId: bet.id,
                matchId,
              },
            });
          }
        }

        await tx.match.update({
          where: { id: matchId },
          data: { status: MatchStatus.SETTLED, winnerId },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    this.realtime.broadcast('match.settled', { matchId, winnerId });
    this.realtime.broadcast('leaderboard.invalidate', {});
  }

  async cancel(matchId: string) {
    await this.prisma.$transaction(async (tx) => {
      const bets = await tx.bet.findMany({
        where: { matchId, status: BetStatus.PENDING },
      });

      for (const bet of bets) {
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: BetStatus.CANCELLED, settledAt: new Date() },
        });
        await this.wallet.applyDelta(
          tx,
          bet.userId,
          bet.stake,
          TxType.ADMIN_ADJUSTMENT,
          {
            betId: bet.id,
            matchId,
            metadata: { reason: 'MATCH_CANCELLED' },
          },
        );
      }

      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.CANCELLED },
      });
    });

    this.realtime.broadcast('match.cancelled', { matchId });
    this.realtime.broadcast('leaderboard.invalidate', {});
  }
}
