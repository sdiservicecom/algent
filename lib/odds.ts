export const SENSITIVITY = 0.15;
export const MARKET_WEIGHT_MAX = 0.6;
export const MARKET_VOLUME_REF = 5000;
export const SMOOTHING_LAMBDA = 0.25;
export const ODDS_MIN = 1.05;
export const ODDS_MAX = 15.0;

export const MIN_STAKE = 10;
export const MAX_STAKE_ABS = 50_000;
export const LOCK_BEFORE_START_MS = 2 * 60 * 1000;

export interface OddsPair {
  oddsA: number;
  oddsB: number;
}

const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));

const round3 = (x: number) => Math.round(x * 1000) / 1000;

const toOdds = (pA: number): OddsPair => {
  const pB = 1 - pA;
  return {
    oddsA: round3(clamp(1 / pA, ODDS_MIN, ODDS_MAX)),
    oddsB: round3(clamp(1 / pB, ODDS_MIN, ODDS_MAX)),
  };
};

export function computeInitialOdds(seedA: number, seedB: number): OddsPair {
  const diff = seedB - seedA;
  const pA = 1 / (1 + Math.exp(-diff * SENSITIVITY));
  return toOdds(pA);
}

export function recomputeOdds(params: {
  seedA: number;
  seedB: number;
  currentOddsA: number;
  totalStakeA: number;
  totalStakeB: number;
}): OddsPair {
  const { seedA, seedB, currentOddsA, totalStakeA, totalStakeB } = params;
  const V = totalStakeA + totalStakeB;
  const diff = seedB - seedA;

  const pA_seed = 1 / (1 + Math.exp(-diff * SENSITIVITY));
  const pA_market = V > 0 ? totalStakeA / V : pA_seed;
  const marketW = MARKET_WEIGHT_MAX * Math.min(1, V / MARKET_VOLUME_REF);

  const pA_target = (1 - marketW) * pA_seed + marketW * pA_market;
  const pA_current = 1 / currentOddsA;
  const pA_new = pA_current + SMOOTHING_LAMBDA * (pA_target - pA_current);

  return toOdds(pA_new);
}
