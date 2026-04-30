import { Redis } from '@upstash/redis';

/**
 * Client Upstash Redis.
 *
 * Lit `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` (intégration
 * Vercel Marketplace). Fallback sur `KV_REST_API_URL` / `KV_REST_API_TOKEN`
 * si l'ancienne nomenclature Vercel KV est utilisée.
 */
function buildClient(): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing required environment variables UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or legacy KV_REST_API_URL / KV_REST_API_TOKEN)',
    );
  }

  return new Redis({ url, token });
}

const globalForKv = globalThis as unknown as { __algentKv?: Redis };

export const kv: Redis =
  globalForKv.__algentKv ?? (globalForKv.__algentKv = buildClient());

// Conventions de clés (préfixe `algent:`)
export const K = {
  user: (id: string) => `algent:user:${id}`,
  userByUsername: (lower: string) => `algent:username:${lower}`,
  usersAll: () => `algent:users:all`,

  player: (id: string) => `algent:player:${id}`,
  playerBySeed: (seed: number) => `algent:player:bySeed:${seed}`,
  playersByseed: () => `algent:players:byseed`,

  match: (id: string) => `algent:match:${id}`,
  matchesByTime: () => `algent:matches:bytime`,

  bet: (id: string) => `algent:bet:${id}`,
  betsByUser: (userId: string) => `algent:bets:byuser:${userId}`,
  betsByMatch: (matchId: string) => `algent:bets:bymatch:${matchId}`,
  pendingBetsByMatch: (matchId: string) =>
    `algent:bets:pending:bymatch:${matchId}`,
  pendingBetGuard: (userId: string, matchId: string) =>
    `algent:bets:pending:${userId}:${matchId}`,

  tx: (id: string) => `algent:tx:${id}`,
  txsByUser: (userId: string) => `algent:txs:byuser:${userId}`,

  dailyBonus: (userId: string, isoDate: string) =>
    `algent:bonus:${userId}:${isoDate}`,

  oddsSnapshots: (matchId: string) => `algent:odds:bymatch:${matchId}`,
};

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  // fallback (Node sans Web Crypto)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('crypto').randomUUID();
