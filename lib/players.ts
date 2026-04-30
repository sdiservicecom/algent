import { K, kv, newId } from './kv';
import { listMatches } from './matches';
import type { Player } from './types';

export class PlayerError extends Error {
  constructor(public code: 'SEED_TAKEN' | 'IN_USE' | 'NOT_FOUND') {
    super(code);
  }
}

export async function getPlayer(id: string): Promise<Player | null> {
  return kv.get<Player>(K.player(id));
}

export async function listPlayers(): Promise<Player[]> {
  const ids = (await kv.zrange(K.playersByseed(), 0, -1)) as string[];
  if (ids.length === 0) return [];
  const players = await Promise.all(ids.map(getPlayer));
  return players.filter((p): p is Player => !!p);
}

export async function createPlayer(input: {
  firstName: string;
  lastName: string;
  seed: number;
}): Promise<Player> {
  const taken = await kv.set(K.playerBySeed(input.seed), '__placeholder__', {
    nx: true,
  });
  if (taken !== 'OK') throw new PlayerError('SEED_TAKEN');

  const player: Player = {
    id: newId(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    seed: input.seed,
    createdAt: new Date().toISOString(),
  };

  await kv.set(K.player(player.id), player);
  await kv.set(K.playerBySeed(player.seed), player.id);
  await kv.zadd(K.playersByseed(), { score: player.seed, member: player.id });

  return player;
}

export async function deletePlayer(id: string): Promise<void> {
  const player = await getPlayer(id);
  if (!player) throw new PlayerError('NOT_FOUND');

  // Vérifie que le joueur n'est utilisé dans aucun match non annulé
  const matches = await listMatches();
  const used = matches.some(
    (m) =>
      (m.playerAId === id || m.playerBId === id) && m.status !== 'CANCELLED',
  );
  if (used) throw new PlayerError('IN_USE');

  await Promise.all([
    kv.del(K.player(id)),
    kv.del(K.playerBySeed(player.seed)),
    kv.zrem(K.playersByseed(), id),
  ]);
}
