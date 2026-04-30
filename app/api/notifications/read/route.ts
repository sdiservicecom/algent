import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markAllRead, markRead } from '@/lib/notifications';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let body: { id?: string; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = noop */
  }

  if (body.all) {
    await markAllRead(session.sub);
  } else if (body.id) {
    await markRead(session.sub, body.id);
  } else {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
