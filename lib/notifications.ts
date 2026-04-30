import { K, kv, newId } from './kv';
import type { AppNotification, NotificationKind } from './types';

const MAX_PER_USER = 50;

export interface CreateNotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url?: string | null;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<AppNotification> {
  const notif: AppNotification = {
    id: newId(),
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    url: input.url ?? null,
    read: false,
    createdAt: new Date().toISOString(),
  };

  const score = Date.parse(notif.createdAt);
  await kv.set(K.notification(notif.id), notif);
  await kv.zadd(K.notificationsByUser(input.userId), {
    score,
    member: notif.id,
  });
  await kv.sadd(K.unreadByUser(input.userId), notif.id);

  // Trim ancien (au-delà du plafond) pour éviter d'accumuler indéfiniment
  const total = (await kv.zcard(K.notificationsByUser(input.userId))) ?? 0;
  if (total > MAX_PER_USER) {
    const overflow = total - MAX_PER_USER;
    const oldest = (await kv.zrange(
      K.notificationsByUser(input.userId),
      0,
      overflow - 1,
    )) as string[];
    for (const id of oldest) {
      await kv.del(K.notification(id));
      await kv.zrem(K.notificationsByUser(input.userId), id);
      await kv.srem(K.unreadByUser(input.userId), id);
    }
  }

  return notif;
}

export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<AppNotification[]> {
  const ids = (await kv.zrange(
    K.notificationsByUser(userId),
    0,
    limit - 1,
    { rev: true },
  )) as string[];
  if (ids.length === 0) return [];
  const out = await Promise.all(
    ids.map((id) => kv.get<AppNotification>(K.notification(id))),
  );
  return out.filter((n): n is AppNotification => !!n);
}

export async function countUnread(userId: string): Promise<number> {
  const c = await kv.scard(K.unreadByUser(userId));
  return c ?? 0;
}

export async function markRead(userId: string, id: string): Promise<void> {
  const notif = await kv.get<AppNotification>(K.notification(id));
  if (!notif || notif.userId !== userId) return;
  if (!notif.read) {
    await kv.set(K.notification(id), { ...notif, read: true });
  }
  await kv.srem(K.unreadByUser(userId), id);
}

export async function markAllRead(userId: string): Promise<void> {
  const ids = ((await kv.smembers(K.unreadByUser(userId))) ?? []) as string[];
  for (const id of ids) {
    const notif = await kv.get<AppNotification>(K.notification(id));
    if (notif && !notif.read) {
      await kv.set(K.notification(id), { ...notif, read: true });
    }
  }
  await kv.del(K.unreadByUser(userId));
}
