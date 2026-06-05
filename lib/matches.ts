import { K, kv, newId } from './kv';
import {
  SCORE_BONUS_MULTIPLIER,
  computeInitialOdds,
  computeLiveOdds,
} from './odds';
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
    // Par défaut, un match nouvellement créé est immédiatement ouvert
    // aux paris. L'admin peut le verrouiller / annuler via la page
    // détail, mais on évite la friction du "Ouvrir aux paris" oublié.
    status: 'OPEN_FOR_BETS',
    winnerId: '',
    round: input.round ?? '',
    bracketSlot: input.bracketSlot ?? '',
    scoreA: '',
    scoreB: '',
    oddsA: odds.oddsA,
    oddsB: odds.oddsB,
    totalStakeA: 0,
    totalStakeB: 0,
    betCountA: 0,
    betCountB: 0,
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

export async function settleMatch(
  matchId: string,
  winnerId: string,
  finalScore?: { scoreA: number; scoreB: number },
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');
  if (![match.playerAId, match.playerBId].includes(winnerId)) {
    throw new MatchError('INVALID_WINNER');
  }
  if (match.status === 'SETTLED' || match.status === 'CANCELLED') {
    throw new MatchError('ALREADY_FINALIZED');
  }

  // Vérifie la cohérence score / vainqueur si les deux sont fournis.
  if (finalScore) {
    const winnerIsA = winnerId === match.playerAId;
    if (winnerIsA && finalScore.scoreA <= finalScore.scoreB) {
      throw new MatchError('INVALID_WINNER');
    }
    if (!winnerIsA && finalScore.scoreB <= finalScore.scoreA) {
      throw new MatchError('INVALID_WINNER');
    }
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
      const basePayout = Math.floor(bet.stake * bet.oddsAtBet);
      const scoreCorrect =
        finalScore != null &&
        bet.scoreGuessA != null &&
        bet.scoreGuessB != null &&
        bet.scoreGuessA === finalScore.scoreA &&
        bet.scoreGuessB === finalScore.scoreB;
      const scoreBonus = scoreCorrect
        ? Math.floor(bet.stake * SCORE_BONUS_MULTIPLIER)
        : 0;
      const payout = basePayout + scoreBonus;
      const updated: Bet = {
        ...bet,
        status: 'WON',
        payout,
        scoreBonus: scoreBonus || null,
        settledAt: new Date().toISOString(),
      };
      await kv.set(K.bet(betId), updated);
      await applyWalletDelta(bet.userId, payout, 'BET_WON', {
        betId,
        matchId,
        metadata: scoreBonus ? { scoreBonus } : undefined,
      });
      notifications.push(
        createNotification({
          userId: bet.userId,
          kind: 'BET_WON',
          title: scoreBonus ? 'Pari gagné + score exact 🎯' : 'Pari gagné',
          body: scoreBonus
            ? `${matchLabel} — ${winnerLabel} l'emporte ${finalScore!.scoreA}-${finalScore!.scoreB}. +${payout} pts (dont +${scoreBonus} de bonus score exact).`
            : `${matchLabel} — ${winnerLabel} l'emporte. +${payout} pts crédités.`,
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

  const finalUpdates: Record<string, string | number> = {
    status: 'SETTLED',
    winnerId,
  };
  if (finalScore) {
    finalUpdates.scoreA = finalScore.scoreA;
    finalUpdates.scoreB = finalScore.scoreB;
  }
  await kv.hset(K.match(matchId), finalUpdates);
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

/**
 * Réinitialise un match : rembourse les paris encore en attente, remet
 * le status à SCHEDULED, vide score / winner / totaux. Utile pour annuler
 * un règlement erroné ou rouvrir un match.
 *
 * Les paris déjà réglés (WON/LOST) NE SONT PAS touchés ici — utiliser
 * cancelMatch si tu veux annuler propre côté wallet, ou deleteMatch
 * pour effacer.
 */
export async function resetMatch(matchId: string): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');

  // Rembourse tous les paris PENDING (s'il y en a)
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
      metadata: { reason: 'MATCH_RESET' },
    });
    await Promise.all([
      kv.del(K.pendingBetGuard(bet.userId, matchId)),
      kv.srem(K.pendingBetsByMatch(matchId), betId),
    ]);
  }

  // Remet les cotes "fraîches" (cote initiale par seed)
  const [pa, pb] = await Promise.all([
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
  ]);
  const fresh =
    pa && pb
      ? computeInitialOdds(pa.seed, pb.seed)
      : { oddsA: match.oddsA, oddsB: match.oddsB };

  await kv.hset(K.match(matchId), {
    status: 'SCHEDULED',
    winnerId: '',
    scoreA: '',
    scoreB: '',
    totalStakeA: 0,
    totalStakeB: 0,
    betCountA: 0,
    betCountB: 0,
    oddsA: fresh.oddsA,
    oddsB: fresh.oddsB,
  });
  await pushSnapshot(matchId, {
    oddsA: fresh.oddsA,
    oddsB: fresh.oddsB,
    totalStakeA: 0,
    totalStakeB: 0,
    reason: 'RESET',
    createdAt: new Date().toISOString(),
  });
}

/**
 * Supprime définitivement un match et toutes ses données associées
 * (snapshots, paris, index). Les paris déjà réglés sont supprimés mais
 * les wallets transactions restent en historique côté users
 * (intentionnel — la trace est utile pour l'audit).
 *
 * Si le match a des paris en attente, on les annule (rembourse) avant
 * la suppression pour ne pas léser les utilisateurs.
 */
export async function deleteMatch(matchId: string): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) return;

  // 1) Refund pending bets
  const pendingIds = (await kv.smembers(K.pendingBetsByMatch(matchId))) as
    | string[]
    | null;
  for (const betId of pendingIds ?? []) {
    const bet = await kv.get<Bet>(K.bet(betId));
    if (!bet) continue;
    if (bet.status === 'PENDING') {
      await applyWalletDelta(bet.userId, bet.stake, 'ADMIN_ADJUSTMENT', {
        betId,
        matchId,
        metadata: { reason: 'MATCH_DELETED' },
      });
    }
  }

  // 2) Wipe all bets attached to this match
  const allBetIds = (await kv.zrange(K.betsByMatch(matchId), 0, -1)) as string[];
  for (const betId of allBetIds) {
    const bet = await kv.get<Bet>(K.bet(betId));
    if (bet) {
      await Promise.all([
        kv.del(K.bet(betId)),
        kv.zrem(K.betsByUser(bet.userId), betId),
        kv.del(K.pendingBetGuard(bet.userId, matchId)),
      ]);
    }
  }
  await Promise.all([
    kv.del(K.betsByMatch(matchId)),
    kv.del(K.pendingBetsByMatch(matchId)),
    kv.del(K.oddsSnapshots(matchId)),
  ]);

  // 3) Drop the match itself
  await Promise.all([
    kv.del(K.match(matchId)),
    kv.zrem(K.matchesByTime(), matchId),
  ]);
}

/**
 * Met à jour le score courant d'un match en cours (LOCKED → IN_PROGRESS si
 * besoin) et recalcule les cotes "live" en conséquence. Utilisé par le
 * Live Tracker côté admin pour ajouter des points sur le pouce.
 */
export async function setMatchScore(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');
  if (
    match.status !== 'LOCKED' &&
    match.status !== 'IN_PROGRESS' &&
    match.status !== 'OPEN_FOR_BETS'
  ) {
    throw new MatchError('INVALID_TRANSITION');
  }
  const a = Math.max(0, Math.floor(scoreA));
  const b = Math.max(0, Math.floor(scoreB));

  // Passe à IN_PROGRESS si on est encore avant le coup d'envoi.
  if (match.status === 'OPEN_FOR_BETS') {
    await transitionMatchStatus(matchId, 'LOCKED');
    await transitionMatchStatus(matchId, 'IN_PROGRESS');
  } else if (match.status === 'LOCKED') {
    await transitionMatchStatus(matchId, 'IN_PROGRESS');
  }

  // Recalcule des cotes "live" — pondération seed × (1 + score).
  const [pa, pb] = await Promise.all([
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
  ]);
  const odds =
    pa && pb
      ? computeLiveOdds({ seedA: pa.seed, seedB: pb.seed, scoreA: a, scoreB: b })
      : { oddsA: match.oddsA, oddsB: match.oddsB };

  await kv.hset(K.match(matchId), {
    scoreA: a,
    scoreB: b,
    oddsA: odds.oddsA,
    oddsB: odds.oddsB,
  });
  await pushSnapshot(matchId, {
    oddsA: odds.oddsA,
    oddsB: odds.oddsB,
    totalStakeA: match.totalStakeA,
    totalStakeB: match.totalStakeB,
    reason: 'LIVE_SCORE',
    createdAt: new Date().toISOString(),
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

  await kv.hset(K.match(matchId), {
    status: 'CANCELLED',
    // Les paris ont été remboursés, plus aucun parieur "actif" sur ce match.
    betCountA: 0,
    betCountB: 0,
  });

  // Annule la jambe correspondante dans les paris combinés (cote neutre 1.0)
  await resolveCombosForMatch(matchId, null, true);
}

export async function updateMatch(
  matchId: string,
  input: {
    playerAId?: string;
    playerBId?: string;
    startsAt?: Date;
  },
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) throw new MatchError('MATCH_NOT_FOUND');

  // On bloque toute modif après FINISHED — la suite (SETTLED/CANCELLED)
  // est immuable côté wallet. Avant ça, on autorise :
  //  - Changer la date/heure : toujours possible tant que pas réglé
  //    (utile pour repousser le coup d'envoi).
  //  - Changer les joueurs : seulement en SCHEDULED, parce que les paris
  //    déjà posés sont indexés sur ces playerIds.
  if (
    match.status === 'FINISHED' ||
    match.status === 'SETTLED' ||
    match.status === 'CANCELLED'
  ) {
    throw new MatchError('INVALID_TRANSITION');
  }
  const wantsPlayerChange =
    (input.playerAId && input.playerAId !== match.playerAId) ||
    (input.playerBId && input.playerBId !== match.playerBId);
  if (wantsPlayerChange && match.status !== 'SCHEDULED') {
    throw new MatchError('INVALID_TRANSITION');
  }

  const updates: Record<string, string | number> = {};
  let recompute = false;

  if (input.startsAt) {
    updates.startsAt = input.startsAt.toISOString();
    await kv.zadd(K.matchesByTime(), {
      score: input.startsAt.getTime(),
      member: matchId,
    });
  }
  if (input.playerAId && input.playerAId !== match.playerAId) {
    updates.playerAId = input.playerAId;
    recompute = true;
  }
  if (input.playerBId && input.playerBId !== match.playerBId) {
    updates.playerBId = input.playerBId;
    recompute = true;
  }

  if (recompute) {
    const newAId = (updates.playerAId as string) ?? match.playerAId;
    const newBId = (updates.playerBId as string) ?? match.playerBId;
    if (newAId === newBId) throw new MatchError('INVALID_WINNER');
    const [pa, pb] = await Promise.all([
      getPlayer(newAId),
      getPlayer(newBId),
    ]);
    if (!pa || !pb) throw new MatchError('PLAYER_NOT_FOUND');
    const odds = computeInitialOdds(pa.seed, pb.seed);
    updates.oddsA = String(odds.oddsA);
    updates.oddsB = String(odds.oddsB);
  }

  if (Object.keys(updates).length > 0) {
    await kv.hset(K.match(matchId), updates);
  }
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
  const optInt = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
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
    scoreA: optInt(raw.scoreA),
    scoreB: optInt(raw.scoreB),
    oddsA: Number(raw.oddsA ?? 0),
    oddsB: Number(raw.oddsB ?? 0),
    totalStakeA: Number(raw.totalStakeA ?? 0),
    totalStakeB: Number(raw.totalStakeB ?? 0),
    betCountA: Number(raw.betCountA ?? 0),
    betCountB: Number(raw.betCountB ?? 0),
    createdAt: String(raw.createdAt ?? ''),
  };
}
