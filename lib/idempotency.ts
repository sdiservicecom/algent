import { kv } from './kv';

const TTL_SECONDS = 60;

/**
 * Réserve atomiquement une clé d'idempotence par utilisateur. Renvoie `true`
 * la première fois, `false` si la clé a déjà été vue dans la fenêtre TTL.
 */
export async function reserveIdempotencyKey(
  userId: string,
  key: string,
): Promise<boolean> {
  const k = `algent:idem:${userId}:${key}`;
  const reserved = await kv.set(k, '1', { nx: true, ex: TTL_SECONDS });
  return reserved === 'OK';
}
