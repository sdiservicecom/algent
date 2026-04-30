import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { BetError, placeBet } from '@/lib/bets';
import { WalletError } from '@/lib/wallet';
import { checkLimit, limits } from '@/lib/ratelimit';
import { reserveIdempotencyKey } from '@/lib/idempotency';
import { bumpCache } from '@/lib/cache';

interface BatchItem {
  matchId: string;
  pickedPlayerId: string;
  stake: number;
  scoreGuessA?: number | null;
  scoreGuessB?: number | null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const rl = await checkLimit(limits.bet, session.sub);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const idemKey = req.headers.get('idempotency-key');
  if (idemKey) {
    const fresh = await reserveIdempotencyKey(session.sub, `batch:${idemKey}`);
    if (!fresh) {
      return NextResponse.json(
        { error: 'DUPLICATE_REQUEST' },
        { status: 409 },
      );
    }
  }

  let items: BatchItem[];
  try {
    const body = (await req.json()) as { items?: BatchItem[] };
    items = (body.items ?? []).filter(
      (i) =>
        typeof i?.matchId === 'string' &&
        typeof i?.pickedPlayerId === 'string' &&
        Number.isFinite(i?.stake),
    );
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const placed: string[] = [];
  const errors: Record<string, string> = {};

  const cleanScore = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  for (const item of items) {
    try {
      await placeBet({
        userId: session.sub,
        matchId: item.matchId,
        pickedPlayerId: item.pickedPlayerId,
        stake: Math.floor(item.stake),
        scoreGuessA: cleanScore(item.scoreGuessA),
        scoreGuessB: cleanScore(item.scoreGuessB),
      });
      placed.push(item.matchId);
    } catch (e) {
      if (e instanceof BetError || e instanceof WalletError) {
        errors[item.matchId] = e.code;
      } else {
        errors[item.matchId] = 'UNKNOWN';
        console.error('[bets/batch]', e);
      }
    }
  }

  if (placed.length > 0)
    bumpCache('matches', 'leaderboard', 'user-bets', 'user-tx');
  revalidatePath('/matches');
  revalidatePath('/dashboard');

  return NextResponse.json({ placed, errors });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
