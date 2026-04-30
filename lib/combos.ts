import { K, kv, newId } from './kv';
import { getMatch } from './matches';
import { LOCK_BEFORE_START_MS, MAX_STAKE_ABS, MIN_STAKE } from './odds';
import { createNotification } from './notifications';
import { applyWalletDelta } from './wallet';
import type { ComboBet, ComboLeg } from './types';

const MIN_LEGS = 2;
const MAX_LEGS = 10;

export class ComboError extends Error {
  constructor(
    public code:
      | 'STAKE_OUT_OF_BOUNDS'
      | 'TOO_FEW_LEGS'
      | 'TOO_MANY_LEGS'
      | 'DUPLICATE_LEG'
      | 'MATCH_NOT_FOUND'
      | 'MATCH_NOT_OPEN'
      | 'MATCH_STARTED'
      | 'INVALID_PLAYER',
  ) {
    super(code);
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export interface PlaceComboInput {
  userId: string;
  stake: number;
  legs: Array<{ matchId: string; pickedPlayerId: string }>;
}

export async function placeComboBet(input: PlaceComboInput): Promise<ComboBet> {
  if (input.stake < MIN_STAKE || input.stake > MAX_STAKE_ABS) {
    throw new ComboError('STAKE_OUT_OF_BOUNDS');
  }
  if (input.legs.length < MIN_LEGS) throw new ComboError('TOO_FEW_LEGS');
  if (input.legs.length > MAX_LEGS) throw new ComboError('TOO_MANY_LEGS');

  const seen = new Set<string>();
  for (const l of input.legs) {
    if (seen.has(l.matchId)) throw new ComboError('DUPLICATE_LEG');
    seen.add(l.matchId);
  }

  // Vérifie chaque match avant tout débit
  const enriched: ComboLeg[] = [];
  for (const l of input.legs) {
    const m = await getMatch(l.matchId);
    if (!m) throw new ComboError('MATCH_NOT_FOUND');
    if (m.status !== 'OPEN_FOR_BETS') throw new ComboError('MATCH_NOT_OPEN');
    if (
      new Date(m.startsAt).getTime() - Date.now() <
      LOCK_BEFORE_START_MS
    ) {
      throw new ComboError('MATCH_STARTED');
    }
    if (
      l.pickedPlayerId !== m.playerAId &&
      l.pickedPlayerId !== m.playerBId
    ) {
      throw new ComboError('INVALID_PLAYER');
    }
    const oddsAtBet =
      l.pickedPlayerId === m.playerAId ? m.oddsA : m.oddsB;
    enriched.push({
      matchId: l.matchId,
      pickedPlayerId: l.pickedPlayerId,
      oddsAtBet,
      status: 'PENDING',
    });
  }

  const combinedOdds = round3(
    enriched.reduce((p, l) => p * l.oddsAtBet, 1),
  );
  const potentialWin = Math.floor(input.stake * combinedOdds);
  const id = newId();
  const placedAt = new Date().toISOString();

  // Débit unique de la mise (le payload metadata trace que c'est un combo)
  await applyWalletDelta(input.userId, -input.stake, 'BET_PLACED', {
    metadata: { combo: true, comboId: id },
  });

  const combo: ComboBet = {
    id,
    userId: input.userId,
    legs: enriched,
    stake: input.stake,
    combinedOdds,
    potentialWin,
    status: 'PENDING',
    payout: null,
    placedAt,
    settledAt: null,
  };

  await kv.set(K.combo(id), combo);
  await kv.zadd(K.combosByUser(input.userId), {
    score: Date.parse(placedAt),
    member: id,
  });
  for (const l of enriched) {
    await kv.sadd(K.combosByMatch(l.matchId), id);
  }

  return combo;
}

export async function getCombo(id: string): Promise<ComboBet | null> {
  return kv.get<ComboBet>(K.combo(id));
}

export async function listUserCombos(userId: string): Promise<ComboBet[]> {
  const ids = (await kv.zrange(K.combosByUser(userId), 0, -1, {
    rev: true,
  })) as string[];
  if (ids.length === 0) return [];
  const out = await Promise.all(
    ids.map((id) => kv.get<ComboBet>(K.combo(id))),
  );
  return out.filter((c): c is ComboBet => !!c);
}

/**
 * Met à jour les paris combinés qui contiennent une jambe sur ce match.
 *
 * Si le match est annulé : la jambe correspondante passe à CANCELLED avec une
 * cote neutre (1.0), le combo continue avec une cote combinée recalculée.
 * Si tous les legs sont gagnants → combo gagné, paiement crédité.
 * Si un leg est perdu → combo perdu (pas de paiement, mise déjà débitée).
 */
export async function resolveCombosForMatch(
  matchId: string,
  winnerId: string | null,
  cancelled: boolean,
): Promise<void> {
  const ids = ((await kv.smembers(K.combosByMatch(matchId))) ?? []) as string[];
  for (const id of ids) {
    const combo = await kv.get<ComboBet>(K.combo(id));
    if (!combo) continue;
    if (combo.status !== 'PENDING') continue;

    let changed = false;
    for (const leg of combo.legs) {
      if (leg.matchId !== matchId || leg.status !== 'PENDING') continue;
      if (cancelled) {
        leg.status = 'CANCELLED';
        leg.oddsAtBet = 1.0;
      } else if (leg.pickedPlayerId === winnerId) {
        leg.status = 'WON';
      } else {
        leg.status = 'LOST';
      }
      changed = true;
    }
    if (!changed) continue;

    combo.combinedOdds = round3(
      combo.legs.reduce((p, l) => p * l.oddsAtBet, 1),
    );
    combo.potentialWin = Math.floor(combo.stake * combo.combinedOdds);

    const anyLost = combo.legs.some((l) => l.status === 'LOST');
    const allDone = combo.legs.every((l) => l.status !== 'PENDING');

    if (anyLost) {
      combo.status = 'LOST';
      combo.payout = 0;
      combo.settledAt = new Date().toISOString();
      try {
        await applyWalletDelta(combo.userId, 0, 'BET_LOST', {
          metadata: { combo: true, comboId: combo.id },
        });
      } catch {
        /* on continue malgré tout */
      }
      await createNotification({
        userId: combo.userId,
        kind: 'BET_LOST',
        title: 'Pari combiné perdu',
        body: `Un pronostic raté — mise de ${combo.stake} pts perdue.`,
        url: '/history',
      });
    } else if (allDone) {
      const payout = combo.potentialWin;
      combo.status = 'WON';
      combo.payout = payout;
      combo.settledAt = new Date().toISOString();
      try {
        await applyWalletDelta(combo.userId, payout, 'BET_WON', {
          metadata: { combo: true, comboId: combo.id },
        });
      } catch {
        /* on continue */
      }
      await createNotification({
        userId: combo.userId,
        kind: 'BET_WON',
        title: 'Pari combiné gagné',
        body: `Cote combinée ${combo.combinedOdds.toFixed(2)} — +${payout} pts crédités.`,
        url: '/history',
      });
    }

    await kv.set(K.combo(combo.id), combo);
  }
  // Le set par-match n'est plus utile une fois le match terminé/annulé
  await kv.del(K.combosByMatch(matchId));
}
