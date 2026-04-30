import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveSubscription, type PushSub } from '@/lib/push';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let sub: PushSub;
  try {
    const body = (await req.json()) as { subscription?: PushSub };
    if (!body.subscription?.endpoint) throw new Error('INVALID');
    sub = body.subscription;
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  await saveSubscription(session.sub, sub);
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
