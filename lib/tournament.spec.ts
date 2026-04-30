import { describe, expect, it } from 'vitest';
import { computeTournamentOdds } from './tournament';
import { ODDS_MAX, ODDS_MIN } from './odds';
import type { Player } from './types';

const mkPlayer = (seed: number): Player => ({
  id: `p${seed}`,
  firstName: `P${seed}`,
  lastName: 'X',
  nickname: null,
  seed,
  photoUrl: null,
  createdAt: new Date().toISOString(),
});

describe('computeTournamentOdds', () => {
  it('returns an empty record when there are no players', () => {
    expect(computeTournamentOdds([])).toEqual({});
  });

  it('gives the lowest odds to the seed-1 player', () => {
    const players = [1, 2, 3, 4, 5, 6, 7, 8].map(mkPlayer);
    const odds = computeTournamentOdds(players);
    const sorted = players
      .map((p) => ({ id: p.id, seed: p.seed, odds: odds[p.id] }))
      .sort((a, b) => a.odds - b.odds);
    expect(sorted[0].seed).toBe(1);
  });

  it('keeps every player odds within the global bounds', () => {
    const players = [1, 2, 4, 8, 16, 32].map(mkPlayer);
    const odds = computeTournamentOdds(players);
    for (const p of players) {
      expect(odds[p.id]).toBeGreaterThanOrEqual(ODDS_MIN);
      expect(odds[p.id]).toBeLessThanOrEqual(ODDS_MAX);
    }
  });

  it('produces implied probabilities that roughly sum to 1', () => {
    const players = [1, 2, 3, 4].map(mkPlayer);
    const odds = computeTournamentOdds(players);
    const sum = players.reduce((s, p) => s + 1 / odds[p.id], 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThan(1.05);
  });
});
