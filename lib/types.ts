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

export type MatchRound = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL';

export const MATCH_ROUNDS: MatchRound[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];

export const MATCH_ROUND_LABEL: Record<MatchRound, string> = {
  R32: '16e de finale',
  R16: 'Huitième',
  QF: 'Quart',
  SF: 'Demi-finale',
  FINAL: 'Finale',
};

export type TxType =
  | 'INITIAL_CREDIT'
  | 'DAILY_BONUS'
  | 'BET_PLACED'
  | 'BET_WON'
  | 'BET_LOST'
  | 'QUIZ_WIN'
  | 'ADMIN_ADJUSTMENT';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role: Role;
  balance: number;
  /** Service / équipe (libellé libre) — alimente le 2e leaderboard. */
  service: string | null;
  createdAt: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  seed: number;
  photoUrl: string | null;
  /** Optionnel : userId d'un compte associé à ce joueur. */
  linkedUserId: string | null;
  createdAt: string;
}

export interface Match {
  id: string;
  playerAId: string;
  playerBId: string;
  startsAt: string;
  status: MatchStatus;
  round: MatchRound | null;
  bracketSlot: number | null;
  winnerId: string | null;
  /** Score final (sets gagnés par chaque joueur), saisi par l'admin au règlement. */
  scoreA: number | null;
  scoreB: number | null;
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
  /**
   * Pronostic optionnel du score exact. Si renseigné et que le score réel
   * du match correspond, l'utilisateur gagne un bonus en plus du payout
   * habituel (cf. SCORE_BONUS_MULTIPLIER).
   */
  scoreGuessA: number | null;
  scoreGuessB: number | null;
  scoreBonus: number | null;
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

export type TournamentStatus = 'OPEN' | 'LOCKED' | 'SETTLED' | 'CANCELLED';

export interface Tournament {
  status: TournamentStatus;
  winnerId: string | null;
}

export interface TournamentBet {
  id: string;
  userId: string;
  pickedPlayerId: string;
  stake: number;
  oddsAtBet: number;
  status: BetStatus;
  potentialWin: number;
  payout: number | null;
  placedAt: string;
  settledAt: string | null;
}

export interface ComboLeg {
  matchId: string;
  pickedPlayerId: string;
  oddsAtBet: number;
  status: BetStatus;
}

export interface ComboBet {
  id: string;
  userId: string;
  legs: ComboLeg[];
  stake: number;
  combinedOdds: number;
  potentialWin: number;
  status: BetStatus;
  payout: number | null;
  placedAt: string;
  settledAt: string | null;
}

export type NotificationKind =
  | 'BET_WON'
  | 'BET_LOST'
  | 'TOURNAMENT_WON'
  | 'TOURNAMENT_LOST'
  | 'INFO';

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

export type AuditAction =
  | 'MATCH_OPEN'
  | 'MATCH_LOCK'
  | 'MATCH_SETTLE'
  | 'MATCH_CANCEL'
  | 'MATCH_CREATE'
  | 'MATCH_UPDATE'
  | 'PLAYER_CREATE'
  | 'PLAYER_UPDATE'
  | 'PLAYER_DELETE'
  | 'TOURNAMENT_OPEN'
  | 'TOURNAMENT_LOCK'
  | 'TOURNAMENT_CANCEL'
  | 'TOURNAMENT_SETTLE'
  | 'USER_PROMOTE'
  | 'USER_DEMOTE'
  | 'USER_ADJUST_BALANCE';

export interface AuditEntry {
  id: string;
  adminId: string;
  adminUsername: string;
  action: AuditAction;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
