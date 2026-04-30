import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { countUnread, listNotifications } from '@/lib/notifications';

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const [items, unread] = await Promise.all([
    listNotifications(session.sub, 20),
    countUnread(session.sub),
  ]);
  return NextResponse.json({ items, unread });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
