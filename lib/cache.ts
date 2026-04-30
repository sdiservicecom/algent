import { unstable_cache, revalidateTag } from 'next/cache';
import { listMatches } from './matches';
import { listPlayers } from './players';
import { listUsers } from './users';
import { getLeaderboard } from './leaderboard';
import { listUserBets } from './bets';
import { listUserCombos } from './combos';
import { listUserTransactions } from './wallet';
import { hasReceivedTodayBonus } from './daily-bonus';

/**
 * Versions cachées des lectures les plus coûteuses.
 *
 * `unstable_cache` mémoïse côté serveur Next.js : un seul calcul même si N
 * utilisateurs rendent la page dans la fenêtre TTL. Couplé à
 * `revalidateTag` (appelé depuis les mutations) on garde la fraîcheur.
 */

export const cachedListMatches = unstable_cache(
  async () => listMatches(),
  ['cache:matches'],
  { revalidate: 20, tags: ['matches'] },
);

export const cachedListPlayers = unstable_cache(
  async () => listPlayers(),
  ['cache:players'],
  { revalidate: 60, tags: ['players'] },
);

export const cachedListUsers = unstable_cache(
  async () => listUsers(),
  ['cache:users'],
  { revalidate: 30, tags: ['users'] },
);

export const cachedGetLeaderboard = unstable_cache(
  async () => getLeaderboard(),
  ['cache:leaderboard'],
  { revalidate: 30, tags: ['leaderboard', 'users', 'matches'] },
);

/**
 * Caches per-user. Les arguments sont automatiquement utilisés comme clé,
 * donc chaque utilisateur a sa propre entrée. TTLs courts car le user
 * place ses propres paris et veut voir le retour rapidement.
 */

export const cachedListUserBets = unstable_cache(
  async (userId: string) => listUserBets(userId),
  ['cache:user-bets'],
  { revalidate: 8, tags: ['user-bets'] },
);

export const cachedListUserCombos = unstable_cache(
  async (userId: string) => listUserCombos(userId),
  ['cache:user-combos'],
  { revalidate: 8, tags: ['user-combos'] },
);

export const cachedListUserTransactions = unstable_cache(
  async (userId: string, limit?: number) =>
    listUserTransactions(userId, limit ?? 50),
  ['cache:user-tx'],
  { revalidate: 10, tags: ['user-tx'] },
);

export const cachedHasReceivedTodayBonus = unstable_cache(
  async (userId: string) => hasReceivedTodayBonus(userId),
  ['cache:user-bonus'],
  { revalidate: 60, tags: ['user-bonus'] },
);

export type CacheTag =
  | 'matches'
  | 'players'
  | 'users'
  | 'leaderboard'
  | 'user-bets'
  | 'user-combos'
  | 'user-tx'
  | 'user-bonus';

/** Invalide un ou plusieurs tags (à appeler après une mutation). */
export function bumpCache(...tags: CacheTag[]) {
  for (const t of tags) revalidateTag(t);
}
