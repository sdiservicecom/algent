import { MatchStatus, TxType } from '@prisma/client';
import { prisma } from './prisma';
import { applyWalletDelta } from './wallet';

export const DAILY_BONUS_AMOUNT = 100;

export async function distributeDailyBonus(now: Date = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hasMatch = await prisma.match.count({
    where: {
      startsAt: { gte: today, lt: tomorrow },
      status: { in: [MatchStatus.SCHEDULED, MatchStatus.OPEN_FOR_BETS] },
    },
  });
  if (hasMatch === 0) return { skipped: true, granted: 0, total: 0 };

  const users = await prisma.user.findMany({ select: { id: true } });
  let granted = 0;
  for (const u of users) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.dailyBonus.create({
          data: {
            userId: u.id,
            bonusDate: today,
            amount: DAILY_BONUS_AMOUNT,
          },
        });
        await applyWalletDelta(tx, u.id, DAILY_BONUS_AMOUNT, TxType.DAILY_BONUS, {
          metadata: { bonusDate: today.toISOString() },
        });
      });
      granted++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== 'P2002') throw e;
    }
  }
  return { skipped: false, granted, total: users.length };
}

export async function hasReceivedTodayBonus(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bonus = await prisma.dailyBonus.findUnique({
    where: { userId_bonusDate: { userId, bonusDate: today } },
  });
  return { received: !!bonus, amount: bonus?.amount ?? null };
}
