import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { claimDailyBonus } from '@/lib/daily-bonus';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const result = await claimDailyBonus(session.sub);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 409 },
    );
  }
  // Invalide les caches utilisateurs/leaderboard pour que le solde mis à
  // jour soit visible immédiatement sur les pages SSR.
  revalidateTag('users');
  revalidateTag('leaderboard');
  return NextResponse.json({ ok: true, amount: result.amount });
}

export const dynamic = 'force-dynamic';
