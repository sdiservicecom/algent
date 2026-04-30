import { NextResponse } from 'next/server';

export async function GET() {
  const env = {
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };

  let kvOk = false;
  let kvError: string | null = null;
  try {
    const { kv } = await import('@/lib/kv');
    await kv.set('algent:healthcheck', Date.now(), { ex: 60 });
    const v = await kv.get<number>('algent:healthcheck');
    kvOk = typeof v === 'number';
  } catch (e) {
    kvError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ env, kvOk, kvError });
}

export const dynamic = 'force-dynamic';
