import { kv } from '@vercel/kv';

export { kv };

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
