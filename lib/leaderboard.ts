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
  // On inclut tous les comptes (USER + ADMIN) : un admin parie comme tout
  // le monde, il doit apparaitre dans le classement. L'ancien filtre
  // .filter(role === 'USER') faisait disparaître le premier user inscrit
  // (auto-promu admin par createUser) et tous les autres promus depuis
  // l'admin.
  const users = await listUsers();

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

export interface ServiceLeaderboardEntry {
  rank: number;
  service: string;
  memberCount: number;
  totalBalance: number;
  totalWon: number;
  totalStaked: number;
  betsWon: number;
  betsLost: number;
  /** Solde moyen par membre — comparaison fair-play entre équipes de tailles différentes. */
  averageBalance: number;
}

/**
 * Agrège les stats par `service`. Les utilisateurs sans service sont
 * regroupés sous "Sans service" et placés en bas du classement. Le tri
 * principal est le **total de points détenu par l'équipe** (avec totalWon
 * et memberCount en tiebreakers).
 */
export async function getServiceLeaderboard(): Promise<ServiceLeaderboardEntry[]> {
  const [rows, users] = await Promise.all([getLeaderboard(), listUsers()]);
  const serviceById = new Map<string, string | null>(
    users.map((u) => [u.id, u.service]),
  );

  const groups = new Map<
    string,
    {
      service: string;
      isNone: boolean;
      memberCount: number;
      totalBalance: number;
      totalWon: number;
      totalStaked: number;
      betsWon: number;
      betsLost: number;
    }
  >();

  for (const r of rows) {
    const raw = serviceById.get(r.userId) ?? null;
    const key = raw && raw.length > 0 ? raw : '__none__';
    const display = raw && raw.length > 0 ? raw : 'Sans service';
    const slot = groups.get(key) ?? {
      service: display,
      isNone: key === '__none__',
      memberCount: 0,
      totalBalance: 0,
      totalWon: 0,
      totalStaked: 0,
      betsWon: 0,
      betsLost: 0,
    };
    slot.memberCount += 1;
    slot.totalBalance += r.balance;
    slot.totalWon += r.totalWon;
    slot.totalStaked += r.totalStaked;
    slot.betsWon += r.betsWon;
    slot.betsLost += r.betsLost;
    groups.set(key, slot);
  }

  const list = Array.from(groups.values());
  list.sort((a, b) => {
    if (a.isNone !== b.isNone) return a.isNone ? 1 : -1;
    if (b.totalBalance !== a.totalBalance)
      return b.totalBalance - a.totalBalance;
    if (b.totalWon !== a.totalWon) return b.totalWon - a.totalWon;
    return b.memberCount - a.memberCount;
  });

  return list.map((s, i) => ({
    rank: i + 1,
    service: s.service,
    memberCount: s.memberCount,
    totalBalance: s.totalBalance,
    totalWon: s.totalWon,
    totalStaked: s.totalStaked,
    betsWon: s.betsWon,
    betsLost: s.betsLost,
    averageBalance:
      s.memberCount > 0 ? Math.round(s.totalBalance / s.memberCount) : 0,
  }));
}
