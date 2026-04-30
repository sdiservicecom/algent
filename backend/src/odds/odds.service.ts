import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

const SENSITIVITY = 0.15;
const MARKET_WEIGHT_MAX = 0.6;
const MARKET_VOLUME_REF = 5000;
const SMOOTHING_LAMBDA = 0.25;
const ODDS_MIN = 1.05;
const ODDS_MAX = 15.0;

export interface OddsPair {
  oddsA: Decimal;
  oddsB: Decimal;
}

@Injectable()
export class OddsService {
  computeInitial(seedA: number, seedB: number): OddsPair {
    const diff = seedB - seedA;
    const pA = 1 / (1 + Math.exp(-diff * SENSITIVITY));
    return this.toOdds(pA);
  }

  recompute(params: {
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

    return this.toOdds(pA_new);
  }

  private toOdds(pA: number): OddsPair {
    const pB = 1 - pA;
    const oddsA = this.clamp(1 / pA, ODDS_MIN, ODDS_MAX);
    const oddsB = this.clamp(1 / pB, ODDS_MIN, ODDS_MAX);
    return {
      oddsA: new Decimal(oddsA.toFixed(3)),
      oddsB: new Decimal(oddsB.toFixed(3)),
    };
  }

  private clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
  }
}
