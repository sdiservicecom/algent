import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TxType } from '@prisma/client';

@Injectable()
export class WalletService {
  /**
   * Doit être appelé à l'intérieur d'une transaction Prisma.
   * Verrou pessimiste sur la ligne user pour éviter les races concurrentes.
   */
  async applyDelta(
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
    if (!user) throw new BadRequestException('USER_NOT_FOUND');

    const newBalance = user.balance + amount;
    if (newBalance < 0) throw new BadRequestException('INSUFFICIENT_BALANCE');

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
}
