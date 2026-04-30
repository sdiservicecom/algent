import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { BetError, placeBet } from '@/lib/bets';
import { WalletError } from '@/lib/wallet';

interface BatchItem {
  matchId: string;
  pickedPlayerId: string;
  stake: number;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

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

  for (const item of items) {
    try {
      await placeBet({
        userId: session.sub,
        matchId: item.matchId,
        pickedPlayerId: item.pickedPlayerId,
        stake: Math.floor(item.stake),
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

  revalidatePath('/matches');
  revalidatePath('/dashboard');

  return NextResponse.json({ placed, errors });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
