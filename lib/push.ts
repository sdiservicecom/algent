import webpush from 'web-push';
import { K, kv } from './kv';

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

let configured = false;
function configure() {
  if (configured) return;
  if (!PUBLIC || !PRIVATE) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured');
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export const pushPublicKey = () => PUBLIC ?? null;
export const pushIsConfigured = () => !!(PUBLIC && PRIVATE);

const subKey = (userId: string) => K.pushSubs(userId);

export async function saveSubscription(userId: string, sub: PushSub) {
  await kv.sadd(subKey(userId), JSON.stringify(sub));
}

export async function listSubscriptions(userId: string): Promise<PushSub[]> {
  const raw = (await kv.smembers(subKey(userId))) as string[] | null;
  if (!raw) return [];
  const out: PushSub[] = [];
  for (const s of raw) {
    try {
      out.push(typeof s === 'string' ? JSON.parse(s) : (s as PushSub));
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function removeRawSubscription(userId: string, raw: string) {
  await kv.srem(subKey(userId), raw);
}

export async function removeSubscription(userId: string, endpoint: string) {
  const raw = (await kv.smembers(subKey(userId))) as string[] | null;
  if (!raw) return;
  for (const s of raw) {
    try {
      const parsed = JSON.parse(s) as PushSub;
      if (parsed.endpoint === endpoint) {
        await removeRawSubscription(userId, s);
      }
    } catch {
      /* ignore */
    }
  }
}

export async function notifyUser(userId: string, payload: PushPayload) {
  if (!pushIsConfigured()) return;
  configure();
  const subs = await listSubscriptions(userId);
  if (subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload), {
          TTL: 60 * 60,
        });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await removeSubscription(userId, sub.endpoint);
        }
      }
    }),
  );
}
