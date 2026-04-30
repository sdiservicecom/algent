import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { countUnread } from '@/lib/notifications';

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const unread = await countUnread(session.sub);
  return NextResponse.json({ unread });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
