import { K, kv, newId } from './kv';
import { ODDS_MAX, ODDS_MIN } from './odds';
import { listPlayers } from './players';
import { createNotification } from './notifications';
import type {
  Player,
  Tournament,
  TournamentBet,
  TournamentStatus,
} from './types';
import { applyWalletDelta, WalletError } from './wallet';

const MIN_STAKE = 10;
const MAX_STAKE_ABS = 50_000;

export class TournamentError extends Error {
  constructor(
    public code:
      | 'NOT_OPEN'
      | 'ALREADY_FINALIZED'
      | 'STAKE_OUT_OF_BOUNDS'
      | 'INVALID_PLAYER'
      | 'BET_ALREADY_PLACED'
      | 'NOT_FOUND',
  ) {
    super(code);
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));

/** Cotes "Gagnant du tournoi" : plage 1.5 (top seed) → 15.0 (dernier seed).
 *  On mappe simplement le rang du joueur (trié par seed asc) sur une
 *  courbe puissance < 1, ce qui :
 *   - garantit des cotes uniques (pas de tas à 15),
 *   - garde le plafond à 15 demandé,
 *   - donne un favori bien marqué et un étalement progressif.
 */
const TOURNAMENT_ODDS_MIN = 1.5;
const TOURNAMENT_ODDS_MAX = 15;
const TOURNAMENT_CURVE = 0.6; // < 1 → favori bien plus bas, étalement serré en haut

export function computeTournamentOdds(
  players: Player[],
): Record<string, number> {
  if (players.length === 0) return {};
  // Tri stable par seed asc (seed = 1 → top favori). Les ex-aequo sur le seed
  // partagent leur position et donc leur cote — c'est logique.
  const sorted = [...players].sort(
    (a, b) => a.seed - b.seed || a.id.localeCompare(b.id),
  );
  const n = sorted.length;
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const cote =
      TOURNAMENT_ODDS_MIN +
      (TOURNAMENT_ODDS_MAX - TOURNAMENT_ODDS_MIN) *
        Math.pow(t, TOURNAMENT_CURVE);
    out[sorted[i].id] = round3(clamp(cote, ODDS_MIN, TOURNAMENT_ODDS_MAX));
  }
  return out;
}

export async function getTournament(): Promise<Tournament> {
  const raw = await kv.hgetall<Record<string, string>>(K.tournament());
  if (!raw || Object.keys(raw).length === 0) {
    return { status: 'OPEN', winnerId: null };
  }
  const winnerId = raw.winnerId ? String(raw.winnerId) : '';
  return {
    status: ((raw.status as TournamentStatus) || 'OPEN') as TournamentStatus,
    winnerId: winnerId.length > 0 ? winnerId : null,
  };
}

export async function setTournamentStatus(next: TournamentStatus) {
  const t = await getTournament();
  if (t.status === 'SETTLED' || t.status === 'CANCELLED') {
    throw new TournamentError('ALREADY_FINALIZED');
  }
  await kv.hset(K.tournament(), { status: next });
}

export async function placeTournamentBet(input: {
  userId: string;
  pickedPlayerId: string;
  stake: number;
}): Promise<TournamentBet> {
  if (input.stake < MIN_STAKE || input.stake > MAX_STAKE_ABS) {
    throw new TournamentError('STAKE_OUT_OF_BOUNDS');
  }
  const t = await getTournament();
  if (t.status !== 'OPEN') throw new TournamentError('NOT_OPEN');

  const players = await listPlayers();
  if (!players.find((p) => p.id === input.pickedPlayerId)) {
    throw new TournamentError('INVALID_PLAYER');
  }
  const odds = computeTournamentOdds(players)[input.pickedPlayerId];
  if (!odds) throw new TournamentError('INVALID_PLAYER');

  const betId = newId();
  const reserved = await kv.set(K.tournamentBetGuard(input.userId), betId, {
    nx: true,
  });
  if (reserved !== 'OK') throw new TournamentError('BET_ALREADY_PLACED');

  const placedAt = new Date().toISOString();
  const potentialWin = Math.floor(input.stake * odds);

  try {
    await applyWalletDelta(input.userId, -input.stake, 'BET_PLACED', {
      betId,
      metadata: { tournament: true },
    });
  } catch (e) {
    await kv.del(K.tournamentBetGuard(input.userId));
    if (e instanceof WalletError) throw e;
    throw e;
  }

  const bet: TournamentBet = {
    id: betId,
    userId: input.userId,
    pickedPlayerId: input.pickedPlayerId,
    stake: input.stake,
    oddsAtBet: odds,
    status: 'PENDING',
    potentialWin,
    payout: null,
    placedAt,
    settledAt: null,
  };

  await kv.set(K.tournamentBet(betId), bet);
  await kv.zadd(K.tournamentBetByUser(input.userId), {
    score: Date.parse(placedAt),
    member: betId,
  });
  await kv.sadd(K.tournamentBetsAll(), betId);
  return bet;
}

export async function getUserTournamentBet(
  userId: string,
): Promise<TournamentBet | null> {
  const guard = await kv.get<string>(K.tournamentBetGuard(userId));
  if (guard) {
    const bet = await kv.get<TournamentBet>(K.tournamentBet(guard));
    if (bet) return bet;
  }
  const ids = (await kv.zrange(K.tournamentBetByUser(userId), 0, 0, {
    rev: true,
  })) as string[];
  if (ids.length === 0) return null;
  return kv.get<TournamentBet>(K.tournamentBet(ids[0]));
}

export async function listAllTournamentBets(): Promise<TournamentBet[]> {
  const ids = ((await kv.smembers(K.tournamentBetsAll())) ?? []) as string[];
  if (ids.length === 0) return [];
  const bets = await Promise.all(
    ids.map((id) => kv.get<TournamentBet>(K.tournamentBet(id))),
  );
  return bets.filter((b): b is TournamentBet => !!b);
}

export async function settleTournament(winnerId: string) {
  const t = await getTournament();
  if (t.status === 'SETTLED' || t.status === 'CANCELLED') {
    throw new TournamentError('ALREADY_FINALIZED');
  }
  const players = await listPlayers();
  if (!players.find((p) => p.id === winnerId)) {
    throw new TournamentError('INVALID_PLAYER');
  }

  const bets = await listAllTournamentBets();
  const notifications: Array<Promise<void>> = [];

  for (const bet of bets) {
    if (bet.status !== 'PENDING') continue;
    const won = bet.pickedPlayerId === winnerId;
    if (won) {
      const payout = Math.floor(bet.stake * bet.oddsAtBet);
      const updated: TournamentBet = {
        ...bet,
        status: 'WON',
        payout,
        settledAt: new Date().toISOString(),
      };
      await kv.set(K.tournamentBet(bet.id), updated);
      await applyWalletDelta(bet.userId, payout, 'BET_WON', {
        betId: bet.id,
        metadata: { tournament: true },
      });
      notifications.push(
        createNotification({
          userId: bet.userId,
          kind: 'TOURNAMENT_WON',
          title: 'Pari tournoi gagné',
          body: `Tu as misé sur le bon vainqueur. +${payout} pts crédités.`,
          url: '/tournament',
        }).then(() => undefined),
      );
    } else {
      const updated: TournamentBet = {
        ...bet,
        status: 'LOST',
        payout: 0,
        settledAt: new Date().toISOString(),
      };
      await kv.set(K.tournamentBet(bet.id), updated);
      await applyWalletDelta(bet.userId, 0, 'BET_LOST', {
        betId: bet.id,
        metadata: { tournament: true },
      });
      notifications.push(
        createNotification({
          userId: bet.userId,
          kind: 'TOURNAMENT_LOST',
          title: 'Pari tournoi perdu',
          body: `Mise de ${bet.stake} pts perdue sur le pari du tournoi.`,
          url: '/tournament',
        }).then(() => undefined),
      );
    }
    await kv.del(K.tournamentBetGuard(bet.userId));
  }

  await kv.hset(K.tournament(), { status: 'SETTLED', winnerId });
  await Promise.allSettled(notifications);
}
