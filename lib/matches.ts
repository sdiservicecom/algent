import { BetStatus, MatchStatus, Prisma, TxType } from '@prisma/client';
import { prisma } from './prisma';
import { computeInitialOdds } from './odds';
import { applyWalletDelta } from './wallet';

export class MatchError extends Error {
  constructor(
    public code:
      | 'MATCH_NOT_FOUND'
      | 'INVALID_WINNER'
      | 'MATCH_ALREADY_FINALIZED'
      | 'PLAYER_NOT_FOUND'
      | 'INVALID_TRANSITION',
  ) {
    super(code);
  }
}

export async function createMatch(params: {
  playerAId: string;
  playerBId: string;
  startsAt: Date;
}) {
  const [playerA, playerB] = await Promise.all([
    prisma.player.findUnique({ where: { id: params.playerAId } }),
    prisma.player.findUnique({ where: { id: params.playerBId } }),
  ]);
  if (!playerA || !playerB) throw new MatchError('PLAYER_NOT_FOUND');

  const odds = computeInitialOdds(playerA.seed, playerB.seed);

  return prisma.$transaction(async (tx) => {
    const match = await tx.match.create({
      data: {
        playerAId: params.playerAId,
        playerBId: params.playerBId,
        startsAt: params.startsAt,
        status: MatchStatus.SCHEDULED,
        oddsA: odds.oddsA,
        oddsB: odds.oddsB,
      },
    });
    await tx.oddsSnapshot.create({
      data: {
        matchId: match.id,
        oddsA: odds.oddsA,
        oddsB: odds.oddsB,
        totalStakeA: 0,
        totalStakeB: 0,
        reason: 'INITIAL',
      },
    });
    return match;
  });
}

export async function transitionMatchStatus(
  matchId: string,
  next: MatchStatus,
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError('MATCH_NOT_FOUND');

  const allowed: Record<MatchStatus, MatchStatus[]> = {
    SCHEDULED: ['OPEN_FOR_BETS', 'CANCELLED'],
    OPEN_FOR_BETS: ['LOCKED', 'CANCELLED'],
    LOCKED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['FINISHED', 'CANCELLED'],
    FINISHED: ['SETTLED'],
    SETTLED: [],
    CANCELLED: [],
  };
  if (!allowed[match.status].includes(next)) {
    throw new MatchError('INVALID_TRANSITION');
  }

  return prisma.match.update({
    where: { id: matchId },
    data: { status: next },
  });
}

export async function settleMatch(matchId: string, winnerId: string) {
  return prisma.$transaction(
    async (tx) => {
      const match = await tx.match.findUnique({ where: { id: matchId } });
      if (!match) throw new MatchError('MATCH_NOT_FOUND');
      if (![match.playerAId, match.playerBId].includes(winnerId)) {
        throw new MatchError('INVALID_WINNER');
      }
      if (
        match.status === MatchStatus.SETTLED ||
        match.status === MatchStatus.CANCELLED
      ) {
        throw new MatchError('MATCH_ALREADY_FINALIZED');
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
          await applyWalletDelta(tx, bet.userId, payout, TxType.BET_WON, {
            betId: bet.id,
            matchId,
          });
        } else {
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              status: BetStatus.LOST,
              payout: 0,
              settledAt: new Date(),
            },
          });
          const user = await tx.user.findUnique({ where: { id: bet.userId } });
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

      return tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.SETTLED, winnerId },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function cancelMatch(matchId: string) {
  return prisma.$transaction(async (tx) => {
    const bets = await tx.bet.findMany({
      where: { matchId, status: BetStatus.PENDING },
    });
    for (const bet of bets) {
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.CANCELLED, settledAt: new Date() },
      });
      await applyWalletDelta(tx, bet.userId, bet.stake, TxType.ADMIN_ADJUSTMENT, {
        betId: bet.id,
        matchId,
        metadata: { reason: 'MATCH_CANCELLED' },
      });
    }
    return tx.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED },
    });
  });
}
