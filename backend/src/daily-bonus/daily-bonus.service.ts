import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MatchStatus, TxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const DAILY_BONUS_AMOUNT = 100;

@Injectable()
export class DailyBonusService {
  private readonly logger = new Logger(DailyBonusService.name);

  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
  ) {}

  @Cron('0 6 * * *')
  async distributeDailyBonus() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hasMatch = await this.prisma.match.count({
      where: {
        startsAt: { gte: today, lt: tomorrow },
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.OPEN_FOR_BETS] },
      },
    });
    if (hasMatch === 0) {
      this.logger.log('No match scheduled today, skipping daily bonus');
      return;
    }

    const users = await this.prisma.user.findMany({ select: { id: true } });
    let granted = 0;

    for (const u of users) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.dailyBonus.create({
            data: {
              userId: u.id,
              bonusDate: today,
              amount: DAILY_BONUS_AMOUNT,
            },
          });
          await this.wallet.applyDelta(
            tx,
            u.id,
            DAILY_BONUS_AMOUNT,
            TxType.DAILY_BONUS,
            { metadata: { bonusDate: today.toISOString() } },
          );
        });
        granted++;
      } catch (e: any) {
        if (e?.code !== 'P2002') {
          this.logger.error(`Bonus failed for ${u.id}: ${e.message}`);
        }
      }
    }

    this.logger.log(
      `Daily bonus distributed to ${granted}/${users.length} users`,
    );
  }
}
