import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { balance: true },
  });
  if (!user) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(user);
}

export const dynamic = 'force-dynamic';
