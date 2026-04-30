import { prisma } from './prisma';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  balance: number;
  totalWon: number;
  totalStaked: number;
  betsWon: number;
  betsLost: number;
  successRate: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      username: string;
      balance: number;
      totalStaked: bigint | null;
      totalWon: bigint | null;
      betsWon: bigint | null;
      betsLost: bigint | null;
    }>
  >`
    SELECT
      u.id            AS "userId",
      u.username      AS "username",
      u.balance       AS "balance",
      COALESCE(SUM(b.stake) FILTER (WHERE b.status IN ('WON','LOST')), 0)     AS "totalStaked",
      COALESCE(SUM(b.payout) FILTER (WHERE b.status = 'WON'), 0)              AS "totalWon",
      COUNT(*) FILTER (WHERE b.status = 'WON')                                AS "betsWon",
      COUNT(*) FILTER (WHERE b.status = 'LOST')                               AS "betsLost"
    FROM "User" u
    LEFT JOIN "Bet" b ON b."userId" = u.id
    WHERE u.role = 'USER'
    GROUP BY u.id
    ORDER BY u.balance DESC, "totalWon" DESC
  `;

  return rows.map((r, i) => {
    const won = Number(r.betsWon ?? 0);
    const lost = Number(r.betsLost ?? 0);
    const total = won + lost;
    return {
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      balance: r.balance,
      totalStaked: Number(r.totalStaked ?? 0),
      totalWon: Number(r.totalWon ?? 0),
      betsWon: won,
      betsLost: lost,
      successRate: total > 0 ? won / total : 0,
    };
  });
}
