import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { ComboError, placeComboBet } from '@/lib/combos';
import { WalletError } from '@/lib/wallet';
import { checkLimit, limits } from '@/lib/ratelimit';
import { reserveIdempotencyKey } from '@/lib/idempotency';
import { bumpCache } from '@/lib/cache';

interface BodyItem {
  matchId: string;
  pickedPlayerId: string;
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
    const fresh = await reserveIdempotencyKey(session.sub, `combo:${idemKey}`);
    if (!fresh) {
      return NextResponse.json(
        { error: 'DUPLICATE_REQUEST' },
        { status: 409 },
      );
    }
  }

  let stake: number;
  let items: BodyItem[];
  try {
    const body = (await req.json()) as {
      stake?: number;
      items?: BodyItem[];
    };
    stake = Math.floor(Number(body.stake));
    items = (body.items ?? []).filter(
      (i) =>
        i &&
        typeof i.matchId === 'string' &&
        typeof i.pickedPlayerId === 'string',
    );
    if (!Number.isFinite(stake)) throw new Error('INVALID_STAKE');
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  try {
    const combo = await placeComboBet({
      userId: session.sub,
      stake,
      legs: items,
    });
    bumpCache('matches', 'leaderboard', 'user-combos', 'user-tx');
    revalidatePath('/dashboard');
    revalidatePath('/history');
    revalidatePath('/matches');
    return NextResponse.json({ combo });
  } catch (e) {
    if (e instanceof ComboError || e instanceof WalletError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    console.error('[bets/combo]', e);
    return NextResponse.json({ error: 'UNKNOWN' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
