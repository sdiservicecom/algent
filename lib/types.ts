export type Role = 'USER' | 'ADMIN';

export type MatchStatus =
  | 'SCHEDULED'
  | 'OPEN_FOR_BETS'
  | 'LOCKED'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'SETTLED'
  | 'CANCELLED';

export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';

export type TxType =
  | 'INITIAL_CREDIT'
  | 'DAILY_BONUS'
  | 'BET_PLACED'
  | 'BET_WON'
  | 'BET_LOST'
  | 'ADMIN_ADJUSTMENT';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role: Role;
  balance: number;
  createdAt: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  seed: number;
  photoUrl: string | null;
  createdAt: string;
}

export interface Match {
  id: string;
  playerAId: string;
  playerBId: string;
  startsAt: string;
  status: MatchStatus;
  winnerId: string | null;
  oddsA: number;
  oddsB: number;
  totalStakeA: number;
  totalStakeB: number;
  createdAt: string;
}

export interface Bet {
  id: string;
  userId: string;
  matchId: string;
  pickedPlayerId: string;
  stake: number;
  oddsAtBet: number;
  status: BetStatus;
  potentialWin: number;
  payout: number | null;
  placedAt: string;
  settledAt: string | null;
}

export interface PointTransaction {
  id: string;
  userId: string;
  type: TxType;
  amount: number;
  balanceAfter: number;
  betId: string | null;
  matchId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface OddsSnapshot {
  oddsA: number;
  oddsB: number;
  totalStakeA: number;
  totalStakeB: number;
  reason: string;
  createdAt: string;
}
