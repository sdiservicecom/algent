import { NextResponse } from 'next/server';
import { pushPublicKey } from '@/lib/push';

export async function GET() {
  const key = pushPublicKey();
  if (!key) {
    return NextResponse.json(
      { error: 'PUSH_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: key });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
