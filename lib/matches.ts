import { K, kv, newId } from './kv';
import { computeInitialOdds } from './odds';
import {
  MATCH_ROUNDS,
  type Bet,
  type Match,
  type MatchRound,
  type MatchStatus,
  type OddsSnapshot,
} from './types';
import { getPlayer } from './players';
import { createNotification } from './notifications';
import { resolveCombosForMatch } from './combos';
import { applyWalletDelta } from './wallet';
import { fmtPlayerName } from './format';

export class MatchError extends Error {
  constructor(
    public code:
      | 'MATCH_NOT_FOUND'
      | 'INVALID_WINNER'
      | 'ALREADY_FINALIZED'
      | 'PLAYER_NOT_FOUND'
      | 'INVALID_TRANSITION',
  ) {
    super(code);
  }
}

export async function getMatch(id: string): Promise<Match | null> {
  const data = await kv.hgetall<Record<string, string | number>>(K.match(id));
  if (!data || Object.keys(data).length === 0) return null;
  return parseMatch(id, data);
}

export async function listMatches(): Promise<Match[]> {
  const ids = (await kv.zrange(K.matchesByTime(), 0, -1)) as string[];
  if (ids.length === 0) return [];
  const matches = await Promise.all(ids.map(getMatch));
  return matches.filter((m): m is Match => !!m);
}

export async function createMatch(input: {
  playerAId: string;
  playerBId: string;
  startsAt: Date;
  round?: MatchRound | null;
  bracketSlot?: number | null;
}): Promise<Match> {
  const [pa, pb] = await Promise.all([
    getPlayer(input.playerAId),
    getPlayer(input.playerBId),
  ]);
  if (!pa || !pb) throw new MatchError('PLAYER_NOT_FOUND');

  const odds = computeInitialOdds(pa.seed, pb.seed);
  const id = newId();
  const startsAtIso = input.startsAt.toISOString();
  const createdAt = new Date().toISOString();

  await kv.hset(K.match(id), {
    playerAId: input.playerAId,
    playerBId: input.playerBId,
    startsAt: startsAtIso,
    status: 'SCHEDULED',
    winnerId: '',
    round: input.round ?? '',
    bracketSlot: input.bracketSlot ?? '',
    oddsA: odds.oddsA,
    oddsB: odds.oddsB,
    totalStakeA: 0,
    totalStakeB: 0,
    createdAt,
  });
  await kv.zadd(K.matchesByTime(), {
    score: input.startsAt.getTime(),
    member: id,
  });
  await pushSnapshot(id, {
    oddsA: odds.oddsA,
    oddsB: odds.oddsB,
    totalStakeA: 0,
    totalStakeB: 0,
    reason: 'INITIAL',
    createdAt,
  });

  return (await getMatch(id))!;
}

const ALLOWED: Record<MatchStatus, MatchStatus[]> = {
  SCHEDULED: ['OPEN_FOR_BETS', 'CANCELLED'],
  OPEN_FOR_BETS: ['LOCKED', 'CANCELLED'],
  LOCKED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['FINISHED', 'CANCELLED'],
  FINISHED: ['SETTLED'],
  SETTLED: [],
  CANCELLED: [],
};

export async function transitionMatchStatus(
  matchId: string,
  next: MatchStatus,
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');
  if (!ALLOWED[match.status].includes(next)) {
    throw new MatchError('INVALID_TRANSITION');
  }
  await kv.hset(K.match(matchId), { status: next });
}

export async function settleMatch(matchId: string, winnerId: string): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');
  if (![match.playerAId, match.playerBId].includes(winnerId)) {
    throw new MatchError('INVALID_WINNER');
  }
  if (match.status === 'SETTLED' || match.status === 'CANCELLED') {
    throw new MatchError('ALREADY_FINALIZED');
  }

  const pendingIds = await kv.smembers(K.pendingBetsByMatch(matchId));
  const ids = (pendingIds ?? []) as string[];

  const [winner, pa, pb] = await Promise.all([
    getPlayer(winnerId),
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
  ]);
  const matchLabel = pa && pb ? `${fmtPlayerName(pa)} vs ${fmtPlayerName(pb)}` : 'votre match';
  const winnerLabel = winner ? fmtPlayerName(winner) : 'le vainqueur';
  const notifications: Array<Promise<void>> = [];

  for (const betId of ids) {
    const bet = await kv.get<Bet>(K.bet(betId));
    if (!bet || bet.status !== 'PENDING') continue;

    const won = bet.pickedPlayerId === winnerId;
    if (won) {
      const payout = Math.floor(bet.stake * bet.oddsAtBet);
      const updated: Bet = {
        ...bet,
        status: 'WON',
        payout,
        settledAt: new Date().toISOString(),
      };
      await kv.set(K.bet(betId), updated);
      await applyWalletDelta(bet.userId, payout, 'BET_WON', {
        betId,
        matchId,
      });
      notifications.push(
        createNotification({
          userId: bet.userId,
          kind: 'BET_WON',
          title: 'Pari gagné',
          body: `${matchLabel} — ${winnerLabel} l'emporte. +${payout} pts crédités.`,
          url: '/history',
        }).then(() => undefined),
      );
    } else {
      const updated: Bet = {
        ...bet,
        status: 'LOST',
        payout: 0,
        settledAt: new Date().toISOString(),
      };
      await kv.set(K.bet(betId), updated);
      await applyWalletDelta(bet.userId, 0, 'BET_LOST', { betId, matchId });
      notifications.push(
        createNotification({
          userId: bet.userId,
          kind: 'BET_LOST',
          title: 'Pari perdu',
          body: `${matchLabel} — ${winnerLabel} l'emporte. Mise de ${bet.stake} pts perdue.`,
          url: '/history',
        }).then(() => undefined),
      );
    }

    // Libère les guards uniquement après transition
    await Promise.all([
      kv.del(K.pendingBetGuard(bet.userId, matchId)),
      kv.srem(K.pendingBetsByMatch(matchId), betId),
    ]);
  }

  await kv.hset(K.match(matchId), { status: 'SETTLED', winnerId });
  await Promise.allSettled(notifications);

  // Met à jour les paris combinés qui touchent ce match
  await resolveCombosForMatch(matchId, winnerId, false);

  // Propagation bracket : injecte le vainqueur dans le match du round suivant.
  await propagateBracketWinner({ ...match, status: 'SETTLED', winnerId });
}

async function findMatchByBracket(
  round: MatchRound,
  slot: number,
): Promise<Match | null> {
  const all = await listMatches();
  return (
    all.find((m) => m.round === round && m.bracketSlot === slot) ?? null
  );
}

async function propagateBracketWinner(prev: Match): Promise<void> {
  if (!prev.round || prev.bracketSlot == null || !prev.winnerId) return;
  const idx = MATCH_ROUNDS.indexOf(prev.round);
  if (idx < 0 || idx >= MATCH_ROUNDS.length - 1) return; // FINAL ou inconnu
  const nextRound = MATCH_ROUNDS[idx + 1];
  const nextSlot = Math.ceil(prev.bracketSlot / 2);
  // Slot impair → côté A du match suivant ; slot pair → côté B
  const sideA = prev.bracketSlot % 2 === 1;

  const next = await findMatchByBracket(nextRound, nextSlot);

  if (next) {
    if (next.status !== 'SCHEDULED') return;
    const betsCount = (await kv.zcard(K.betsByMatch(next.id))) ?? 0;
    if (betsCount > 0) return;

    const newAId = sideA ? prev.winnerId : next.playerAId;
    const newBId = sideA ? next.playerBId : prev.winnerId;
    const [pa, pb] = await Promise.all([
      getPlayer(newAId),
      getPlayer(newBId),
    ]);
    const updates: Record<string, string | number> = {
      [sideA ? 'playerAId' : 'playerBId']: prev.winnerId,
    };
    if (pa && pb) {
      const odds = computeInitialOdds(pa.seed, pb.seed);
      updates.oddsA = odds.oddsA;
      updates.oddsB = odds.oddsB;
    }
    await kv.hset(K.match(next.id), updates);
    return;
  }

  // Pas de match suivant existant : on en crée un seulement quand le match
  // jumeau (sister) est aussi réglé, pour avoir les deux joueurs.
  const sisterSlot = sideA ? prev.bracketSlot + 1 : prev.bracketSlot - 1;
  if (sisterSlot < 1) return;
  const sister = await findMatchByBracket(prev.round, sisterSlot);
  if (!sister || sister.status !== 'SETTLED' || !sister.winnerId) return;

  const aWinnerId = sideA ? prev.winnerId : sister.winnerId;
  const bWinnerId = sideA ? sister.winnerId : prev.winnerId;
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await createMatch({
    playerAId: aWinnerId,
    playerBId: bWinnerId,
    startsAt,
    round: nextRound,
    bracketSlot: nextSlot,
  });
}

export async function cancelMatch(matchId: string): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');

  const pendingIds = (await kv.smembers(K.pendingBetsByMatch(matchId))) as
    | string[]
    | null;

  for (const betId of pendingIds ?? []) {
    const bet = await kv.get<Bet>(K.bet(betId));
    if (!bet || bet.status !== 'PENDING') continue;

    const updated: Bet = {
      ...bet,
      status: 'CANCELLED',
      settledAt: new Date().toISOString(),
    };
    await kv.set(K.bet(betId), updated);
    await applyWalletDelta(bet.userId, bet.stake, 'ADMIN_ADJUSTMENT', {
      betId,
      matchId,
      metadata: { reason: 'MATCH_CANCELLED' },
    });
    await Promise.all([
      kv.del(K.pendingBetGuard(bet.userId, matchId)),
      kv.srem(K.pendingBetsByMatch(matchId), betId),
    ]);
  }

  await kv.hset(K.match(matchId), { status: 'CANCELLED' });

  // Annule la jambe correspondante dans les paris combinés (cote neutre 1.0)
  await resolveCombosForMatch(matchId, null, true);
}

export async function setMatchBracketInfo(
  matchId: string,
  round: MatchRound | null,
  bracketSlot: number | null,
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');
  await kv.hset(K.match(matchId), {
    round: round ?? '',
    bracketSlot: bracketSlot ?? '',
  });
}

export async function listOddsSnapshots(matchId: string): Promise<OddsSnapshot[]> {
  const items = (await kv.lrange(K.oddsSnapshots(matchId), 0, -1)) as
    | OddsSnapshot[]
    | null;
  return items ?? [];
}

export async function pushSnapshot(matchId: string, snap: OddsSnapshot) {
  await kv.rpush(K.oddsSnapshots(matchId), snap);
}

function parseMatch(id: string, raw: Record<string, string | number>): Match {
  const winnerId = raw.winnerId ? String(raw.winnerId) : '';
  const roundRaw = raw.round ? String(raw.round) : '';
  const slotRaw = raw.bracketSlot;
  return {
    id,
    playerAId: String(raw.playerAId ?? ''),
    playerBId: String(raw.playerBId ?? ''),
    startsAt: String(raw.startsAt ?? ''),
    status: (raw.status as MatchStatus) ?? 'SCHEDULED',
    round: roundRaw ? (roundRaw as MatchRound) : null,
    bracketSlot:
      slotRaw === undefined || slotRaw === '' || slotRaw === null
        ? null
        : Number(slotRaw),
    winnerId: winnerId.length > 0 ? winnerId : null,
    oddsA: Number(raw.oddsA ?? 0),
    oddsB: Number(raw.oddsB ?? 0),
    totalStakeA: Number(raw.totalStakeA ?? 0),
    totalStakeB: Number(raw.totalStakeB ?? 0),
    createdAt: String(raw.createdAt ?? ''),
  };
}
