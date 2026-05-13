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
