import { Ratelimit } from '@upstash/ratelimit';
import { kv } from './kv';

/**
 * Rate-limiters partagés. On garde le client KV existant comme backend.
 *
 * Si `UPSTASH_REDIS_REST_URL` est absent (par ex. en test), on tombe sur un
 * limiter nul qui laisse tout passer.
 */
const enabled = !!process.env.UPSTASH_REDIS_REST_URL;

function build(prefix: string, limit: number, window: `${number} ${'s' | 'm' | 'h'}`) {
  if (!enabled) {
    return {
      limit: async () => ({ success: true, limit, reset: 0, remaining: limit }),
    };
  }
  return new Ratelimit({
    redis: kv as unknown as ConstructorParameters<typeof Ratelimit>[0]['redis'],
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `algent:rl:${prefix}`,
    analytics: false,
  });
}

export const limits = {
  // Auth — bruteforce protection
  login: build('login', 10, '1 m'),
  register: build('register', 5, '10 m'),
  // Bets — empêche le hammering de placement
  bet: build('bet', 20, '1 m'),
  // Notifications API (poll par tab)
  notifications: build('notifs', 30, '1 m'),
};

export interface RateLimitOk {
  ok: true;
  remaining: number;
}
export interface RateLimitDenied {
  ok: false;
  retryAfterSec: number;
}

export async function checkLimit(
  limiter: { limit: (key: string) => Promise<{ success: boolean; reset: number; remaining: number }> },
  key: string,
): Promise<RateLimitOk | RateLimitDenied> {
  const res = await limiter.limit(key);
  if (res.success) return { ok: true, remaining: res.remaining };
  const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  return { ok: false, retryAfterSec };
}
