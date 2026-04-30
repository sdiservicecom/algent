import { K, kv, newId } from './kv';
import type { AuditAction, AuditEntry } from './types';

const MAX_ENTRIES = 500;

export interface LogAuditInput {
  adminId: string;
  adminUsername: string;
  action: AuditAction;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(input: LogAuditInput): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: newId(),
    adminId: input.adminId,
    adminUsername: input.adminUsername,
    action: input.action,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date().toISOString(),
  };
  const score = Date.parse(entry.createdAt);
  await kv.set(K.auditEntry(entry.id), entry);
  await kv.zadd(K.auditAll(), { score, member: entry.id });

  // Garde-fou : on conserve les 500 dernières entrées.
  const total = (await kv.zcard(K.auditAll())) ?? 0;
  if (total > MAX_ENTRIES) {
    const overflow = total - MAX_ENTRIES;
    const oldest = (await kv.zrange(K.auditAll(), 0, overflow - 1)) as string[];
    for (const id of oldest) {
      await kv.del(K.auditEntry(id));
      await kv.zrem(K.auditAll(), id);
    }
  }
  return entry;
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const ids = (await kv.zrange(K.auditAll(), 0, limit - 1, {
    rev: true,
  })) as string[];
  if (ids.length === 0) return [];
  const out = await Promise.all(
    ids.map((id) => kv.get<AuditEntry>(K.auditEntry(id))),
  );
  return out.filter((e): e is AuditEntry => !!e);
}
