import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUser } from '@/lib/users';

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const user = await getUser(session.sub);
  if (!user) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ balance: user.balance });
}

export const dynamic = 'force-dynamic';
