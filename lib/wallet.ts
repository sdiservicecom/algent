import { K, kv, newId } from './kv';
import type { PointTransaction, TxType } from './types';

export class WalletError extends Error {
  constructor(public code: 'INSUFFICIENT_BALANCE') {
    super(code);
  }
}

/**
 * Applique un delta de solde et journalise une transaction.
 *
 * On utilise HINCRBY (atomique). Si le delta est négatif et que le résultat
 * descendrait sous 0, on annule (HINCRBY +amount) et on lève WalletError.
 *
 * Note: une autre requête peut très brièvement voir un solde négatif entre
 * le HINCRBY et le rollback. Pour un tournoi interne c'est acceptable.
 */
export async function applyWalletDelta(
  userId: string,
  amount: number,
  type: TxType,
  meta?: { betId?: string; matchId?: string; metadata?: Record<string, unknown> },
): Promise<PointTransaction> {
  const newBalance = (await kv.hincrby(K.user(userId), 'balance', amount)) as number;

  if (newBalance < 0) {
    await kv.hincrby(K.user(userId), 'balance', -amount); // rollback
    throw new WalletError('INSUFFICIENT_BALANCE');
  }

  const tx: PointTransaction = {
    id: newId(),
    userId,
    type,
    amount,
    balanceAfter: newBalance,
    betId: meta?.betId ?? null,
    matchId: meta?.matchId ?? null,
    metadata: meta?.metadata ?? null,
    createdAt: new Date().toISOString(),
  };

  await kv.set(K.tx(tx.id), tx);
  await kv.zadd(K.txsByUser(userId), {
    score: Date.parse(tx.createdAt),
    member: tx.id,
  });

  return tx;
}

export async function listUserTransactions(
  userId: string,
  limit = 50,
): Promise<PointTransaction[]> {
  const ids = (await kv.zrange(K.txsByUser(userId), 0, limit - 1, {
    rev: true,
  })) as string[];
  if (ids.length === 0) return [];
  const txs = await Promise.all(
    ids.map((id) => kv.get<PointTransaction>(K.tx(id))),
  );
  return txs.filter((t): t is PointTransaction => !!t);
}
