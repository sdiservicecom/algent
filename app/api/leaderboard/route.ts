import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getLeaderboard } from '@/lib/leaderboard';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  return NextResponse.json(await getLeaderboard());
}

export const dynamic = 'force-dynamic';
