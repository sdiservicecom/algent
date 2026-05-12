import { K, kv } from './kv';
import { listMatches } from './matches';
import { listUserIds } from './users';
import { applyWalletDelta } from './wallet';

export const DAILY_BONUS_AMOUNT = 100;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function distributeDailyBonus(now: Date = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const matches = await listMatches();
  const hasMatch = matches.some((m) => {
    const t = new Date(m.startsAt).getTime();
    return (
      t >= today.getTime() &&
      t < tomorrow.getTime() &&
      (m.status === 'SCHEDULED' || m.status === 'OPEN_FOR_BETS')
    );
  });
  if (!hasMatch) return { skipped: true, granted: 0, total: 0 };

  const userIds = await listUserIds();
  let granted = 0;
  const date = isoDate(today);

  for (const userId of userIds) {
    const reserved = await kv.set(
      K.dailyBonus(userId, date),
      DAILY_BONUS_AMOUNT,
      { nx: true },
    );
    if (reserved !== 'OK') continue; // déjà attribué aujourd'hui

    await applyWalletDelta(userId, DAILY_BONUS_AMOUNT, 'DAILY_BONUS', {
      metadata: { bonusDate: date },
    });
    granted++;
  }

  return { skipped: false, granted, total: userIds.length };
}

export async function hasReceivedTodayBonus(userId: string) {
  const today = isoDate(new Date());
  const amount = await kv.get<number>(K.dailyBonus(userId, today));
  return { received: amount != null, amount: amount ?? null };
}

export type ClaimBonusResult =
  | { ok: true; amount: number }
  | { ok: false; reason: 'ALREADY_CLAIMED' };

/**
 * Réclamation manuelle (depuis le bouton "Récupérer le bonus quotidien").
 * Pose le marqueur en `NX` pour éviter les double-crédits puis applique le
 * delta wallet. Contrairement au cron, on n'exige pas qu'il y ait un match
 * aujourd'hui — l'utilisateur fait l'effort de cliquer, on lui donne ses
 * points.
 */
export async function claimDailyBonus(
  userId: string,
): Promise<ClaimBonusResult> {
  const today = isoDate(new Date());
  const reserved = await kv.set(
    K.dailyBonus(userId, today),
    DAILY_BONUS_AMOUNT,
    { nx: true },
  );
  if (reserved !== 'OK') return { ok: false, reason: 'ALREADY_CLAIMED' };
  await applyWalletDelta(userId, DAILY_BONUS_AMOUNT, 'DAILY_BONUS', {
    metadata: { bonusDate: today, source: 'manual' },
  });
  return { ok: true, amount: DAILY_BONUS_AMOUNT };
}
