import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { answerQuiz } from '@/lib/quiz';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  let pickedPlayerId: string;
  try {
    const body = (await req.json()) as { pickedPlayerId?: string };
    pickedPlayerId = String(body?.pickedPlayerId ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  if (!pickedPlayerId) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const result = await answerQuiz(session.sub, pickedPlayerId);
  if (!result.ok) {
    const status = result.reason === 'ALREADY_ANSWERED' ? 409 : 400;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }
  if (result.status === 'won') {
    revalidateTag('users');
    revalidateTag('leaderboard');
  }
  return NextResponse.json({
    ok: true,
    status: result.status,
    correctPlayerId: result.correctPlayerId,
    reward: result.reward,
  });
}

export const dynamic = 'force-dynamic';
