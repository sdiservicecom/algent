import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET() {
  const env = {
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    KV_URL: !!process.env.KV_URL,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };

  let kvOk = false;
  let kvError: string | null = null;
  try {
    await kv.set('algent:healthcheck', Date.now(), { ex: 60 });
    const v = await kv.get<number>('algent:healthcheck');
    kvOk = typeof v === 'number';
  } catch (e) {
    kvError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ env, kvOk, kvError });
}

export const dynamic = 'force-dynamic';
