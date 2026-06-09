import { K, kv, newId } from './kv';
import type { Role, User } from './types';
import { applyWalletDelta } from './wallet';

const INITIAL_CREDIT = 1000;

export async function getUser(id: string): Promise<User | null> {
  const data = await kv.hgetall<Record<string, string | number>>(K.user(id));
  if (!data || Object.keys(data).length === 0) return null;
  return parseUser(id, data);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const id = await kv.get<string>(K.userByUsername(username.toLowerCase()));
  if (!id) return null;
  return getUser(id);
}

export async function listUserIds(): Promise<string[]> {
  const ids = await kv.smembers(K.usersAll());
  return (ids ?? []) as string[];
}

export async function listUsers(): Promise<User[]> {
  const ids = await listUserIds();
  const users = await Promise.all(ids.map(getUser));
  return users.filter((u): u is User => !!u);
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role?: Role;
  service?: string | null;
}

const MAX_SERVICE_LEN = 60;

function normalizeService(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.slice(0, MAX_SERVICE_LEN);
}

export class UserError extends Error {
  constructor(public code: 'USERNAME_TAKEN' | 'INVALID_INPUT') {
    super(code);
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const username = input.username.trim();
  if (
    !input.firstName.trim() ||
    !input.lastName.trim() ||
    username.length < 3 ||
    !input.passwordHash
  ) {
    throw new UserError('INVALID_INPUT');
  }

  const id = newId();
  const lower = username.toLowerCase();

  // Réserve atomiquement le username
  const reserved = await kv.set(K.userByUsername(lower), id, { nx: true });
  if (reserved !== 'OK') throw new UserError('USERNAME_TAKEN');

  // Le premier utilisateur inscrit devient ADMIN automatiquement
  const existingCount = (await kv.scard(K.usersAll())) ?? 0;
  const role: Role =
    input.role ?? (existingCount === 0 ? 'ADMIN' : 'USER');
  const createdAt = new Date().toISOString();
  const service = normalizeService(input.service);

  await kv.hset(K.user(id), {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    username,
    passwordHash: input.passwordHash,
    role,
    balance: 0,
    service: service ?? '',
    createdAt,
  });
  await kv.sadd(K.usersAll(), id);

  // Crédit initial pour tout le monde
  await applyWalletDelta(id, INITIAL_CREDIT, 'INITIAL_CREDIT');

  return (await getUser(id))!;
}

export async function setUserRole(id: string, role: Role): Promise<void> {
  const user = await getUser(id);
  if (!user) throw new UserError('INVALID_INPUT');
  await kv.hset(K.user(id), { role });
}

/**
 * Renomme un utilisateur. Réserve atomiquement le nouveau pseudo via
 * `kv.set(NX)` sur l'index `username -> id` pour bloquer les courses
 * (deux utilisateurs qui prennent le même alias en même temps), puis
 * met à jour le hash user et nettoie l'ancien index.
 *
 * - INVALID_INPUT si trop court (<3 caractères)
 * - USERNAME_TAKEN si l'alias est déjà pris
 * - Si le nouveau pseudo n'est qu'une variation de casse de l'ancien
 *   (alice ↔ Alice), on met juste à jour la chaîne affichée sans
 *   toucher l'index.
 */
export async function setUserUsername(
  id: string,
  raw: string,
): Promise<void> {
  const trimmed = raw.trim();
  if (trimmed.length < 3) throw new UserError('INVALID_INPUT');
  const user = await getUser(id);
  if (!user) throw new UserError('INVALID_INPUT');

  const oldLower = user.username.toLowerCase();
  const newLower = trimmed.toLowerCase();

  if (oldLower === newLower) {
    // Même alias en minuscule → juste rafraichir la casse affichée.
    if (trimmed !== user.username) {
      await kv.hset(K.user(id), { username: trimmed });
    }
    return;
  }

  const reserved = await kv.set(K.userByUsername(newLower), id, { nx: true });
  if (reserved !== 'OK') throw new UserError('USERNAME_TAKEN');

  await kv.hset(K.user(id), { username: trimmed });
  await kv.del(K.userByUsername(oldLower));
}

/**
 * Remplace le hash du mot de passe stocké pour cet utilisateur. À appeler
 * uniquement avec un hash déjà calculé (bcrypt). Le contrôle de l'ancien
 * mot de passe doit être fait en amont par l'appelant si nécessaire.
 */
export async function setUserPasswordHash(
  id: string,
  passwordHash: string,
): Promise<void> {
  const user = await getUser(id);
  if (!user) throw new UserError('INVALID_INPUT');
  if (!passwordHash) throw new UserError('INVALID_INPUT');
  await kv.hset(K.user(id), { passwordHash });
}

/**
 * Met à jour le service de l'utilisateur. Passe `null` ou une chaîne vide
 * pour le retirer. Tronque à 60 caractères pour limiter le bruit.
 */
export async function setUserService(
  id: string,
  service: string | null,
): Promise<void> {
  const user = await getUser(id);
  if (!user) throw new UserError('INVALID_INPUT');
  const normalized = normalizeService(service);
  await kv.hset(K.user(id), { service: normalized ?? '' });
}

export async function adjustUserBalance(
  id: string,
  delta: number,
  reason: string,
): Promise<void> {
  if (!Number.isFinite(delta) || delta === 0) return;
  await applyWalletDelta(id, delta, 'ADMIN_ADJUSTMENT', {
    metadata: { reason },
  });
}

function parseUser(id: string, raw: Record<string, string | number>): User {
  const rawService = raw.service != null ? String(raw.service).trim() : '';
  return {
    id,
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    username: String(raw.username ?? ''),
    passwordHash: String(raw.passwordHash ?? ''),
    role: (raw.role as Role) ?? 'USER',
    balance: Number(raw.balance ?? 0),
    service: rawService.length > 0 ? rawService : null,
    createdAt: String(raw.createdAt ?? ''),
  };
}
