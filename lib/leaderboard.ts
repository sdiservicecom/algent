import { listUserBets } from './bets';
import { listUsers } from './users';

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
  const users = (await listUsers()).filter((u) => u.role === 'USER');

  const stats = await Promise.all(
    users.map(async (u) => {
      const bets = await listUserBets(u.id);
      let totalStaked = 0;
      let totalWon = 0;
      let betsWon = 0;
      let betsLost = 0;
      for (const b of bets) {
        if (b.status === 'WON' || b.status === 'LOST') {
          totalStaked += b.stake;
        }
        if (b.status === 'WON') {
          totalWon += b.payout ?? 0;
          betsWon++;
        } else if (b.status === 'LOST') {
          betsLost++;
        }
      }
      const total = betsWon + betsLost;
      return {
        userId: u.id,
        username: u.username,
        balance: u.balance,
        totalStaked,
        totalWon,
        betsWon,
        betsLost,
        successRate: total > 0 ? betsWon / total : 0,
      };
    }),
  );

  stats.sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    return b.totalWon - a.totalWon;
  });

  return stats.map((s, i) => ({ rank: i + 1, ...s }));
}
