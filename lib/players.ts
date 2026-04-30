import { K, kv, newId } from './kv';
import { listMatches } from './matches';
import type { Player } from './types';

export class PlayerError extends Error {
  constructor(public code: 'SEED_TAKEN' | 'IN_USE' | 'NOT_FOUND') {
    super(code);
  }
}

export async function getPlayer(id: string): Promise<Player | null> {
  const raw = await kv.get<Partial<Player> & { id?: string }>(K.player(id));
  if (!raw || !raw.id) return null;
  // Compat: les joueurs créés avant l'ajout de nickname / photoUrl.
  return { nickname: null, photoUrl: null, ...raw } as Player;
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
  nickname?: string | null;
  photoUrl?: string | null;
}): Promise<Player> {
  const taken = await kv.set(K.playerBySeed(input.seed), '__placeholder__', {
    nx: true,
  });
  if (taken !== 'OK') throw new PlayerError('SEED_TAKEN');

  const nickname = input.nickname?.trim();

  const player: Player = {
    id: newId(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nickname: nickname && nickname.length > 0 ? nickname : null,
    seed: input.seed,
    photoUrl: normalizePhotoUrl(input.photoUrl),
    createdAt: new Date().toISOString(),
  };

  await kv.set(K.player(player.id), player);
  await kv.set(K.playerBySeed(player.seed), player.id);
  await kv.zadd(K.playersByseed(), { score: player.seed, member: player.id });

  return player;
}

function normalizePhotoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
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
