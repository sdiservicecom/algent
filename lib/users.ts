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

  await kv.hset(K.user(id), {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    username,
    passwordHash: input.passwordHash,
    role,
    balance: 0,
    createdAt,
  });
  await kv.sadd(K.usersAll(), id);

  // Crédit initial pour tout le monde
  await applyWalletDelta(id, INITIAL_CREDIT, 'INITIAL_CREDIT');

  return (await getUser(id))!;
}

function parseUser(id: string, raw: Record<string, string | number>): User {
  return {
    id,
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    username: String(raw.username ?? ''),
    passwordHash: String(raw.passwordHash ?? ''),
    role: (raw.role as Role) ?? 'USER',
    balance: Number(raw.balance ?? 0),
    createdAt: String(raw.createdAt ?? ''),
  };
}
