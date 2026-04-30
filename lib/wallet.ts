import { Prisma, TxType } from '@prisma/client';

export class WalletError extends Error {
  constructor(public code: 'INSUFFICIENT_BALANCE' | 'USER_NOT_FOUND') {
    super(code);
  }
}

/**
 * Verrouille la ligne user, applique le delta, et journalise la transaction.
 * Doit être appelé à l'intérieur d'une transaction Prisma.
 */
export async function applyWalletDelta(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  type: TxType,
  meta?: { betId?: string; matchId?: string; metadata?: Prisma.InputJsonValue },
) {
  const rows = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
    SELECT id, balance FROM "User" WHERE id = ${userId} FOR UPDATE
  `;
  const user = rows[0];
  if (!user) throw new WalletError('USER_NOT_FOUND');

  const newBalance = user.balance + amount;
  if (newBalance < 0) throw new WalletError('INSUFFICIENT_BALANCE');

  await tx.user.update({
    where: { id: userId },
    data: { balance: newBalance },
  });

  return tx.pointTransaction.create({
    data: {
      userId,
      type,
      amount,
      balanceAfter: newBalance,
      betId: meta?.betId,
      matchId: meta?.matchId,
      metadata: meta?.metadata,
    },
  });
}
