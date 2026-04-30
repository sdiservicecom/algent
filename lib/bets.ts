import { BetStatus, MatchStatus, Prisma, TxType } from '@prisma/client';
import { prisma } from './prisma';
import { LOCK_BEFORE_START_MS, MAX_STAKE_ABS, MIN_STAKE, recomputeOdds } from './odds';
import { applyWalletDelta } from './wallet';

export class BetError extends Error {
  constructor(
    public code:
      | 'STAKE_OUT_OF_BOUNDS'
      | 'MATCH_NOT_FOUND'
      | 'MATCH_NOT_OPEN'
      | 'MATCH_STARTED'
      | 'INVALID_PLAYER'
      | 'BET_ALREADY_PLACED',
  ) {
    super(code);
  }
}

export interface PlaceBetInput {
  userId: string;
  matchId: string;
  pickedPlayerId: string;
  stake: number;
}

export async function placeBet(input: PlaceBetInput) {
  if (input.stake < MIN_STAKE || input.stake > MAX_STAKE_ABS) {
    throw new BetError('STAKE_OUT_OF_BOUNDS');
  }

  return prisma.$transaction(
    async (tx) => {
      const matchRows = await tx.$queryRaw<Array<any>>`
        SELECT * FROM "Match" WHERE id = ${input.matchId} FOR UPDATE
      `;
      const match = matchRows[0];
      if (!match) throw new BetError('MATCH_NOT_FOUND');

      if (match.status !== MatchStatus.OPEN_FOR_BETS) {
        throw new BetError('MATCH_NOT_OPEN');
      }
      if (
        new Date(match.startsAt).getTime() - Date.now() <
        LOCK_BEFORE_START_MS
      ) {
        throw new BetError('MATCH_STARTED');
      }
      if (![match.playerAId, match.playerBId].includes(input.pickedPlayerId)) {
        throw new BetError('INVALID_PLAYER');
      }

      const existing = await tx.bet.findFirst({
        where: {
          userId: input.userId,
          matchId: input.matchId,
          status: BetStatus.PENDING,
        },
      });
      if (existing) throw new BetError('BET_ALREADY_PLACED');

      const isPickA = input.pickedPlayerId === match.playerAId;
      const oddsAtBet = isPickA ? match.oddsA : match.oddsB;
      const potentialWin = Math.floor(input.stake * Number(oddsAtBet));

      const bet = await tx.bet.create({
        data: {
          userId: input.userId,
          matchId: match.id,
          pickedPlayerId: input.pickedPlayerId,
          stake: input.stake,
          oddsAtBet,
          potentialWin,
          status: BetStatus.PENDING,
        },
      });

      await applyWalletDelta(tx, input.userId, -input.stake, TxType.BET_PLACED, {
        betId: bet.id,
        matchId: match.id,
      });

      const newTotalA = match.totalStakeA + (isPickA ? input.stake : 0);
      const newTotalB = match.totalStakeB + (isPickA ? 0 : input.stake);

      const playerA = await tx.player.findUnique({
        where: { id: match.playerAId },
      });
      const playerB = await tx.player.findUnique({
        where: { id: match.playerBId },
      });

      const newOdds = recomputeOdds({
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

      return bet;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
