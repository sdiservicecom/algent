import { K, kv, newId } from './kv';
import {
  LOCK_BEFORE_START_MS,
  MAX_STAKE_ABS,
  MIN_STAKE,
  recomputeOdds,
} from './odds';
import { getPlayer } from './players';
import { getMatch, pushSnapshot } from './matches';
import { applyWalletDelta, WalletError } from './wallet';
import type { Bet } from './types';

export class BetError extends Error {
  constructor(
    public code:
      | 'STAKE_OUT_OF_BOUNDS'
      | 'MATCH_NOT_FOUND'
      | 'MATCH_NOT_OPEN'
      | 'MATCH_STARTED'
      | 'INVALID_PLAYER'
      | 'BET_ALREADY_PLACED',
  ) {
    super(code);
  }
}

export interface PlaceBetInput {
  userId: string;
  matchId: string;
  pickedPlayerId: string;
  stake: number;
  scoreGuessA?: number | null;
  scoreGuessB?: number | null;
}

export async function placeBet(input: PlaceBetInput): Promise<Bet> {
  if (input.stake < MIN_STAKE || input.stake > MAX_STAKE_ABS) {
    throw new BetError('STAKE_OUT_OF_BOUNDS');
  }

  const match = await getMatch(input.matchId);
  if (!match) throw new BetError('MATCH_NOT_FOUND');
  if (match.status !== 'OPEN_FOR_BETS') throw new BetError('MATCH_NOT_OPEN');
  if (
    new Date(match.startsAt).getTime() - Date.now() <
    LOCK_BEFORE_START_MS
  ) {
    throw new BetError('MATCH_STARTED');
  }
  if (
    input.pickedPlayerId !== match.playerAId &&
    input.pickedPlayerId !== match.playerBId
  ) {
    throw new BetError('INVALID_PLAYER');
  }

  const betId = newId();

  // Réserve atomiquement le pari unique (userId, matchId)
  const reserved = await kv.set(
    K.pendingBetGuard(input.userId, input.matchId),
    betId,
    { nx: true },
  );
  if (reserved !== 'OK') throw new BetError('BET_ALREADY_PLACED');

  const isPickA = input.pickedPlayerId === match.playerAId;
  const oddsAtBet = isPickA ? match.oddsA : match.oddsB;
  const potentialWin = Math.floor(input.stake * oddsAtBet);
  const placedAt = new Date().toISOString();

  // Débite (et rollback du guard si solde insuffisant)
  try {
    await applyWalletDelta(input.userId, -input.stake, 'BET_PLACED', {
      betId,
      matchId: input.matchId,
    });
  } catch (e) {
    await kv.del(K.pendingBetGuard(input.userId, input.matchId));
    if (e instanceof WalletError) throw e;
    throw e;
  }

  const bet: Bet = {
    id: betId,
    userId: input.userId,
    matchId: input.matchId,
    pickedPlayerId: input.pickedPlayerId,
    stake: input.stake,
    oddsAtBet,
    status: 'PENDING',
    potentialWin,
    payout: null,
    scoreGuessA:
      typeof input.scoreGuessA === 'number' && Number.isFinite(input.scoreGuessA)
        ? Math.max(0, Math.floor(input.scoreGuessA))
        : null,
    scoreGuessB:
      typeof input.scoreGuessB === 'number' && Number.isFinite(input.scoreGuessB)
        ? Math.max(0, Math.floor(input.scoreGuessB))
        : null,
    scoreBonus: null,
    placedAt,
    settledAt: null,
  };

  await kv.set(K.bet(betId), bet);
  await kv.zadd(K.betsByUser(input.userId), {
    score: Date.parse(placedAt),
    member: betId,
  });
  await kv.zadd(K.betsByMatch(input.matchId), {
    score: Date.parse(placedAt),
    member: betId,
  });
  await kv.sadd(K.pendingBetsByMatch(input.matchId), betId);

  // Met à jour les totaux et recalcule les cotes
  const newTotalA = (await kv.hincrby(
    K.match(input.matchId),
    'totalStakeA',
    isPickA ? input.stake : 0,
  )) as number;
  const newTotalB = (await kv.hincrby(
    K.match(input.matchId),
    'totalStakeB',
    isPickA ? 0 : input.stake,
  )) as number;
  // Et le nombre de parieurs (1 par user grâce à pendingBetGuard) pour
  // afficher le "% des parieurs sur ce côté" sur les cartes match.
  await kv.hincrby(
    K.match(input.matchId),
    isPickA ? 'betCountA' : 'betCountB',
    1,
  );

  const [pa, pb] = await Promise.all([
    getPlayer(match.playerAId),
    getPlayer(match.playerBId),
  ]);
  if (pa && pb) {
    const newOdds = recomputeOdds({
      seedA: pa.seed,
      seedB: pb.seed,
      currentOddsA: match.oddsA,
      totalStakeA: newTotalA,
      totalStakeB: newTotalB,
    });
    await kv.hset(K.match(input.matchId), {
      oddsA: newOdds.oddsA,
      oddsB: newOdds.oddsB,
    });
    await pushSnapshot(input.matchId, {
      oddsA: newOdds.oddsA,
      oddsB: newOdds.oddsB,
      totalStakeA: newTotalA,
      totalStakeB: newTotalB,
      reason: 'BET_PLACED',
      createdAt: new Date().toISOString(),
    });
  }

  return bet;
}

export async function getBet(id: string): Promise<Bet | null> {
  return kv.get<Bet>(K.bet(id));
}

export async function listUserBets(userId: string): Promise<Bet[]> {
  const ids = (await kv.zrange(K.betsByUser(userId), 0, -1, {
    rev: true,
  })) as string[];
  if (ids.length === 0) return [];
  const bets = await Promise.all(ids.map((id) => kv.get<Bet>(K.bet(id))));
  return bets.filter((b): b is Bet => !!b);
}

export async function listMatchBets(matchId: string): Promise<Bet[]> {
  const ids = (await kv.zrange(K.betsByMatch(matchId), 0, -1)) as string[];
  if (ids.length === 0) return [];
  const bets = await Promise.all(ids.map((id) => kv.get<Bet>(K.bet(id))));
  return bets.filter((b): b is Bet => !!b);
}

export async function findActivePendingBet(
  userId: string,
  matchId: string,
): Promise<Bet | null> {
  const betId = await kv.get<string>(K.pendingBetGuard(userId, matchId));
  if (!betId) return null;
  return getBet(betId);
}
