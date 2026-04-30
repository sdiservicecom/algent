import { NextResponse } from 'next/server';
import { distributeDailyBonus } from '@/lib/daily-bonus';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const result = await distributeDailyBonus();
  return NextResponse.json(result);
}

export const dynamic = 'force-dynamic';
