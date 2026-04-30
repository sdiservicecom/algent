import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const { passwordHash, ...safe } = user;
  return NextResponse.json(safe);
}

export const dynamic = 'force-dynamic';
