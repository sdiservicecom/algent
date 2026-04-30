import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { removeSubscription } from '@/lib/push';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let endpoint: string;
  try {
    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) throw new Error('INVALID');
    endpoint = body.endpoint;
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  await removeSubscription(session.sub, endpoint);
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
