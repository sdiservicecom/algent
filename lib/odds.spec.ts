import { describe, expect, it } from 'vitest';
import {
  ODDS_MAX,
  ODDS_MIN,
  computeInitialOdds,
  recomputeOdds,
} from './odds';

describe('computeInitialOdds', () => {
  it('returns symmetric odds when seeds are equal', () => {
    const { oddsA, oddsB } = computeInitialOdds(4, 4);
    expect(oddsA).toBe(oddsB);
    expect(Math.abs(1 / oddsA + 1 / oddsB - 1)).toBeLessThan(0.001);
  });

  it('lowers the odds for the better-seeded player', () => {
    const { oddsA, oddsB } = computeInitialOdds(1, 8);
    expect(oddsA).toBeLessThan(oddsB);
  });

  it('keeps odds within the configured bounds for extreme seeds', () => {
    const huge = computeInitialOdds(1, 64);
    expect(huge.oddsA).toBeGreaterThanOrEqual(ODDS_MIN);
    expect(huge.oddsA).toBeLessThanOrEqual(ODDS_MAX);
    expect(huge.oddsB).toBeGreaterThanOrEqual(ODDS_MIN);
    expect(huge.oddsB).toBeLessThanOrEqual(ODDS_MAX);
  });

  it('produces probabilities summing to 1 (modulo clamping)', () => {
    const { oddsA, oddsB } = computeInitialOdds(2, 6);
    const sum = 1 / oddsA + 1 / oddsB;
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
  });
});

describe('recomputeOdds', () => {
  const baseSeeds = { seedA: 3, seedB: 5 };

  it('keeps odds within bounds even when stake on one side dominates', () => {
    const out = recomputeOdds({
      ...baseSeeds,
      currentOddsA: 1.7,
      totalStakeA: 1_000_000,
      totalStakeB: 0,
    });
    expect(out.oddsA).toBeGreaterThanOrEqual(ODDS_MIN);
    expect(out.oddsB).toBeLessThanOrEqual(ODDS_MAX);
  });

  it('does not move odds when no stake is placed', () => {
    const init = computeInitialOdds(baseSeeds.seedA, baseSeeds.seedB);
    const recomputed = recomputeOdds({
      ...baseSeeds,
      currentOddsA: init.oddsA,
      totalStakeA: 0,
      totalStakeB: 0,
    });
    expect(Math.abs(recomputed.oddsA - init.oddsA)).toBeLessThan(0.005);
  });

  it('lowers oddsA when most stakes flow on player A', () => {
    const init = computeInitialOdds(baseSeeds.seedA, baseSeeds.seedB);
    const out = recomputeOdds({
      ...baseSeeds,
      currentOddsA: init.oddsA,
      totalStakeA: 4000,
      totalStakeB: 200,
    });
    expect(out.oddsA).toBeLessThan(init.oddsA);
    expect(out.oddsB).toBeGreaterThan(init.oddsB);
  });

  it('converges towards a stable fixpoint after multiple ticks', () => {
    let odds = computeInitialOdds(baseSeeds.seedA, baseSeeds.seedB);
    for (let i = 0; i < 50; i++) {
      odds = recomputeOdds({
        ...baseSeeds,
        currentOddsA: odds.oddsA,
        totalStakeA: 1000,
        totalStakeB: 1000,
      });
    }
    const final1 = odds.oddsA;
    odds = recomputeOdds({
      ...baseSeeds,
      currentOddsA: odds.oddsA,
      totalStakeA: 1000,
      totalStakeB: 1000,
    });
    expect(Math.abs(odds.oddsA - final1)).toBeLessThan(0.001);
  });
});
