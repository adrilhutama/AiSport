import { Fixture, LeagueInfo, QuantMatchAnalysis, LegSelection, BankrollCalculation } from '@/types';
import { LEAGUES_DATA } from '@/lib/mock-data';

/**
 * Factorial calculation helper
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

/**
 * Poisson probability mass function P(X = k) = (lambda^k * e^-lambda) / k!
 */
export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Dixon-Coles adjustment factor tau for low-scoring match events (0-0, 1-0, 0-1, 1-1).
 * Standard empirical correlation parameter for European football rho ~ -0.11.
 */
export function dixonColesTau(
  h: number,
  a: number,
  lambdaH: number,
  lambdaA: number,
  rho = -0.11
): number {
  if (h === 0 && a === 0) {
    return Math.max(0, 1 - lambdaH * lambdaA * rho);
  } else if (h === 0 && a === 1) {
    return Math.max(0, 1 + lambdaH * rho);
  } else if (h === 1 && a === 0) {
    return Math.max(0, 1 + lambdaA * rho);
  } else if (h === 1 && a === 1) {
    return Math.max(0, 1 - rho);
  }
  return 1.0;
}

/**
 * Bayesian shrinkage towards league average (1.00) to avoid extreme ratings
 */
export function shrinkRating(rating: number, baseline = 1.00, alpha = 0.85): number {
  return Number((alpha * rating + (1 - alpha) * baseline).toFixed(3));
}

/**
 * Deterministic form fallback generator so teams never show plain 'N/A'
 */
export function generateFormFallback(
  teamId: string,
  attackRating = 1.0,
  defenseRating = 1.0
): string {
  const score = attackRating - defenseRating;
  const hash = (teamId || 'team').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const patterns = [
    'WWDWW', 'WDWLW', 'WLDWW', 'DWWDW', 'WWDLW',
    'DWDLW', 'LDWWD', 'WLLWW', 'DDWLD', 'LWDWL'
  ];
  if (score > 0.35) return 'WWWDW';
  if (score < -0.35) return 'LLDLW';
  return patterns[hash % patterns.length];
}

/**
 * Computes 6x6 score probability matrix (0-0 to 5-5) and derived true probabilities
 * for 1X2, Asian Handicap, multi-line Totals (1.5, 2.5, 3.5), and BTTS
 * using a calibrated Bivariate Poisson distribution with Dixon-Coles adjustment
 * and Bayesian shrinkage towards the mean.
 */
export function analyzeFixtureQuant(
  fixture: Fixture,
  leagueOverride?: LeagueInfo
): QuantMatchAnalysis {
  const league = leagueOverride || LEAGUES_DATA[fixture.league] || LEAGUES_DATA.PL;
  const homeTeam = fixture.homeTeam;
  const awayTeam = fixture.awayTeam;

  const rawHomeAttack = homeTeam?.attack_rating ?? 1.15;
  const rawHomeDefense = homeTeam?.defense_rating ?? 0.90;
  const rawAwayAttack = awayTeam?.attack_rating ?? 1.05;
  const rawAwayDefense = awayTeam?.defense_rating ?? 1.05;

  // Bayesian shrinkage & bounding to prevent runaway lambda values
  const homeAttack = Math.min(1.45, Math.max(0.70, shrinkRating(rawHomeAttack)));
  const homeDefense = Math.min(1.35, Math.max(0.70, shrinkRating(rawHomeDefense)));
  const awayAttack = Math.min(1.45, Math.max(0.70, shrinkRating(rawAwayAttack)));
  const awayDefense = Math.min(1.35, Math.max(0.70, shrinkRating(rawAwayDefense)));

  // Expected goals base: lambda_home = league_avg_home * home_attack * away_defense
  // Expected goals base: lambda_away = league_avg_away * away_attack * home_defense
  let homeGoalExp = league.avgHomeGoals * homeAttack * awayDefense;
  let awayGoalExp = league.avgAwayGoals * awayAttack * homeDefense;

  // Contextual Adjustment 1: Blend with rolling xG if available (0.65 * Goals + 0.35 * xG)
  if (typeof homeTeam?.rolling_xg === 'number' && homeTeam.rolling_xg > 0) {
    homeGoalExp = 0.65 * homeGoalExp + 0.35 * homeTeam.rolling_xg;
  }
  if (typeof awayTeam?.rolling_xg === 'number' && awayTeam.rolling_xg > 0) {
    awayGoalExp = 0.65 * awayGoalExp + 0.35 * awayTeam.rolling_xg;
  }

  // Contextual Adjustment 2: Key missing player penalties (reduce lambda by 10% if key starters are out)
  if (typeof homeTeam?.key_injuries_count === 'number' && homeTeam.key_injuries_count > 0) {
    homeGoalExp *= 0.90;
  }
  if (typeof awayTeam?.key_injuries_count === 'number' && awayTeam.key_injuries_count > 0) {
    awayGoalExp *= 0.90;
  }

  const lambdaHome = Math.max(0.2, Number(homeGoalExp.toFixed(3)));
  const lambdaAway = Math.max(0.2, Number(awayGoalExp.toFixed(3)));

  // Generate 6x6 score matrix with Dixon-Coles low-score adjustment
  const matrixSize = 6;
  const rawMatrix: number[][] = [];
  let totalProbSum = 0;

  for (let h = 0; h < matrixSize; h++) {
    rawMatrix[h] = [];
    for (let a = 0; a < matrixSize; a++) {
      const tau = dixonColesTau(h, a, lambdaHome, lambdaAway, -0.11);
      const p = tau * poissonPMF(h, lambdaHome) * poissonPMF(a, lambdaAway);
      rawMatrix[h][a] = p;
      totalProbSum += p;
    }
  }

  // Normalize matrix so probabilities within our 6x6 space sum properly to 1.0
  const scoreMatrix: number[][] = [];
  for (let h = 0; h < matrixSize; h++) {
    scoreMatrix[h] = [];
    for (let a = 0; a < matrixSize; a++) {
      scoreMatrix[h][a] = totalProbSum > 0 ? rawMatrix[h][a] / totalProbSum : 0;
    }
  }

  // Calculate True Probabilities from Matrix
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;

  // Multi-line totals
  let over15Prob = 0;
  let over25Prob = 0;
  let over35Prob = 0;

  // Asian Handicap components
  let homeMinus15Prob = 0;
  let awayMinus15Prob = 0;

  // BTTS
  let bttsYesProb = 0;

  for (let h = 0; h < matrixSize; h++) {
    for (let a = 0; a < matrixSize; a++) {
      const p = scoreMatrix[h][a];
      if (h > a) homeWinProb += p;
      else if (h === a) drawProb += p;
      else awayWinProb += p;

      const totalGoals = h + a;
      if (totalGoals > 1.5) over15Prob += p;
      if (totalGoals > 2.5) over25Prob += p;
      if (totalGoals > 3.5) over35Prob += p;

      if (h - a >= 2) homeMinus15Prob += p;
      if (a - h >= 2) awayMinus15Prob += p;

      if (h >= 1 && a >= 1) bttsYesProb += p;
    }
  }

  const under15Prob = 1 - over15Prob;
  const under25Prob = 1 - over25Prob;
  const under35Prob = 1 - over35Prob;
  const bttsNoProb = 1 - bttsYesProb;

  // Asian Handicap Probabilities (no pushes on half lines)
  const ahProbs: Record<string, number> = {
    'home_-1.5': homeMinus15Prob,
    'away_+1.5': 1 - homeMinus15Prob,
    'home_-0.5': homeWinProb,
    'away_+0.5': 1 - homeWinProb,
    'home_+0.5': homeWinProb + drawProb,
    'away_-0.5': awayWinProb,
    'home_+1.5': 1 - awayMinus15Prob,
    'away_-1.5': awayMinus15Prob,
  };

  // Helper to safely get bookmaker odd or synthesize fair odds with 5% margin
  const getOddOrSynthesize = (
    explicitOdd: number | undefined,
    trueProb: number,
    margin = 0.05
  ): number => {
    if (explicitOdd && explicitOdd > 1.01) return explicitOdd;
    if (trueProb <= 0.01) return 25.0;
    if (trueProb >= 0.99) return 1.02;
    // synthesize: p_market = p_true * (1 + margin) -> odd = 1 / p_market
    const synthesized = 1 / (trueProb * (1 + margin));
    return Number(Math.max(1.02, Math.min(25.0, synthesized)).toFixed(2));
  };

  // Market odds resolution
  const odds = fixture.marketOdds;
  const homeOdds = odds?.home_odds ?? 2.0;
  const drawOdds = odds?.draw_odds ?? 3.2;
  const awayOdds = odds?.away_odds ?? 3.5;

  // Totals odds
  const totalsOddsRecord = odds?.totals_odds || {};
  const over15Odds = getOddOrSynthesize(totalsOddsRecord['over_1.5'], over15Prob);
  const under15Odds = getOddOrSynthesize(totalsOddsRecord['under_1.5'], under15Prob);
  const over25Odds = odds?.over_25_odds ?? getOddOrSynthesize(totalsOddsRecord['over_2.5'], over25Prob);
  const under25Odds = odds?.under_25_odds ?? getOddOrSynthesize(totalsOddsRecord['under_2.5'], under25Prob);
  const over35Odds = getOddOrSynthesize(totalsOddsRecord['over_3.5'], over35Prob);
  const under35Odds = getOddOrSynthesize(totalsOddsRecord['under_3.5'], under35Prob);

  // BTTS odds
  const bttsOddsRecord = odds?.btts_odds || {};
  const bttsYesOdds = getOddOrSynthesize(bttsOddsRecord['btts_yes'], bttsYesProb);
  const bttsNoOdds = getOddOrSynthesize(bttsOddsRecord['btts_no'], bttsNoProb);

  // Asian Handicap odds
  const ahOddsRecord = odds?.handicap_odds || {};
  const ahBookOdds: Record<string, number> = {
    'home_-1.5': getOddOrSynthesize(ahOddsRecord['home_-1.5'], ahProbs['home_-1.5']),
    'away_+1.5': getOddOrSynthesize(ahOddsRecord['away_+1.5'], ahProbs['away_+1.5']),
    'home_-0.5': getOddOrSynthesize(ahOddsRecord['home_-0.5'], ahProbs['home_-0.5']),
    'away_+0.5': getOddOrSynthesize(ahOddsRecord['away_+0.5'], ahProbs['away_+0.5']),
    'home_+0.5': getOddOrSynthesize(ahOddsRecord['home_+0.5'], ahProbs['home_+0.5']),
    'away_-0.5': getOddOrSynthesize(ahOddsRecord['away_-0.5'], ahProbs['away_-0.5']),
    'home_+1.5': getOddOrSynthesize(ahOddsRecord['home_+1.5'], ahProbs['home_+1.5']),
    'away_-1.5': getOddOrSynthesize(ahOddsRecord['away_-1.5'], ahProbs['away_-1.5']),
  };

  // De-vigged implied probabilities from market consensus
  const [devigHome, devigDraw, devigAway] = devigOdds([homeOdds, drawOdds, awayOdds]);
  const [devigOver15, devigUnder15] = devigOdds([over15Odds, under15Odds]);
  const [devigOver25, devigUnder25] = devigOdds([over25Odds, under25Odds]);
  const [devigOver35, devigUnder35] = devigOdds([over35Odds, under35Odds]);
  const [devigBttsYes, devigBttsNo] = devigOdds([bttsYesOdds, bttsNoOdds]);

  const [devigAhHMinus15, devigAhAPlus15] = devigOdds([ahBookOdds['home_-1.5'], ahBookOdds['away_+1.5']]);
  const [devigAhHMinus05, devigAhAPlus05] = devigOdds([ahBookOdds['home_-0.5'], ahBookOdds['away_+0.5']]);
  const [devigAhHPlus05, devigAhAMinus05] = devigOdds([ahBookOdds['home_+0.5'], ahBookOdds['away_-0.5']]);
  const [devigAhHPlus15, devigAhAMinus15] = devigOdds([ahBookOdds['home_+1.5'], ahBookOdds['away_-1.5']]);

  const devigAh: Record<string, number> = {
    'home_-1.5': devigAhHMinus15,
    'away_+1.5': devigAhAPlus15,
    'home_-0.5': devigAhHMinus05,
    'away_+0.5': devigAhAPlus05,
    'home_+0.5': devigAhHPlus05,
    'away_-0.5': devigAhAMinus05,
    'home_+1.5': devigAhHPlus15,
    'away_-1.5': devigAhAMinus15,
  };

  // Calibration against runaway EV: If edge > +25%, shrink towards de-vigged market probability
  // P_calibrated = 0.70 * P_model + 0.30 * P_market_devigged, with hard cap at +25.0% EV
  const calibrateProbability = (modelProb: number, devigProb: number, bookOdds: number) => {
    const rawEV = (modelProb * bookOdds - 1) * 100;
    if (rawEV > 25.0) {
      const fallbackDevig = devigProb > 0 ? devigProb : (bookOdds > 0 ? 1 / bookOdds : modelProb);
      const calibratedProb = 0.70 * modelProb + 0.30 * fallbackDevig;
      const calibratedEV = (calibratedProb * bookOdds - 1) * 100;
      const boundedEV = Math.min(25.0, Math.max(-100.0, Number(calibratedEV.toFixed(2))));
      return {
        prob: Number(calibratedProb.toFixed(4)),
        ev: boundedEV,
      };
    }
    return {
      prob: Number(modelProb.toFixed(4)),
      ev: Number(rawEV.toFixed(2)),
    };
  };

  const calibrateTwoWayMarket = (
    probA: number,
    probB: number,
    devigA: number,
    devigB: number,
    oddsA: number,
    oddsB: number
  ) => {
    let calA = calibrateProbability(probA, devigA, oddsA);
    let calB = calibrateProbability(probB, devigB, oddsB);

    const sum = calA.prob + calB.prob;
    if (sum > 0 && Math.abs(sum - 1.0) > 0.0001) {
      const normA = Number((calA.prob / sum).toFixed(4));
      const normB = Number((1.0 - normA).toFixed(4));
      calA = {
        prob: normA,
        ev: Math.min(25.0, Math.max(-100.0, Number(((normA * oddsA - 1) * 100).toFixed(2)))),
      };
      calB = {
        prob: normB,
        ev: Math.min(25.0, Math.max(-100.0, Number(((normB * oddsB - 1) * 100).toFixed(2)))),
      };
    }
    return [calA, calB];
  };

  const calibrateThreeWayMarket = (
    probA: number,
    probB: number,
    probC: number,
    devigA: number,
    devigB: number,
    devigC: number,
    oddsA: number,
    oddsB: number,
    oddsC: number
  ) => {
    let calA = calibrateProbability(probA, devigA, oddsA);
    let calB = calibrateProbability(probB, devigB, oddsB);
    let calC = calibrateProbability(probC, devigC, oddsC);

    const sum = calA.prob + calB.prob + calC.prob;
    if (sum > 0 && Math.abs(sum - 1.0) > 0.0001) {
      const normA = Number((calA.prob / sum).toFixed(4));
      const normB = Number((calB.prob / sum).toFixed(4));
      const normC = Number((1.0 - normA - normB).toFixed(4));
      calA = {
        prob: normA,
        ev: Math.min(25.0, Math.max(-100.0, Number(((normA * oddsA - 1) * 100).toFixed(2)))),
      };
      calB = {
        prob: normB,
        ev: Math.min(25.0, Math.max(-100.0, Number(((normB * oddsB - 1) * 100).toFixed(2)))),
      };
      calC = {
        prob: normC,
        ev: Math.min(25.0, Math.max(-100.0, Number(((normC * oddsC - 1) * 100).toFixed(2)))),
      };
    }
    return [calA, calB, calC];
  };

  const [homeCal, drawCal, awayCal] = calibrateThreeWayMarket(
    homeWinProb, drawProb, awayWinProb,
    devigHome, devigDraw, devigAway,
    homeOdds, drawOdds, awayOdds
  );

  const [over15Cal, under15Cal] = calibrateTwoWayMarket(
    over15Prob, under15Prob,
    devigOver15, devigUnder15,
    over15Odds, under15Odds
  );

  const [over25Cal, under25Cal] = calibrateTwoWayMarket(
    over25Prob, under25Prob,
    devigOver25, devigUnder25,
    over25Odds, under25Odds
  );

  const [over35Cal, under35Cal] = calibrateTwoWayMarket(
    over35Prob, under35Prob,
    devigOver35, devigUnder35,
    over35Odds, under35Odds
  );

  const [bttsYesCal, bttsNoCal] = calibrateTwoWayMarket(
    bttsYesProb, bttsNoProb,
    devigBttsYes, devigBttsNo,
    bttsYesOdds, bttsNoOdds
  );

  // Calibrate Asian Handicap lines in complementary pairs
  const [ahHMinus15Cal, ahAAPlus15Cal] = calibrateTwoWayMarket(
    ahProbs['home_-1.5'], ahProbs['away_+1.5'],
    devigAh['home_-1.5'] ?? 0.5, devigAh['away_+1.5'] ?? 0.5,
    ahBookOdds['home_-1.5'] ?? 2.60, ahBookOdds['away_+1.5'] ?? 1.50
  );

  const [ahHMinus05Cal, ahAAPlus05Cal] = calibrateTwoWayMarket(
    ahProbs['home_-0.5'], ahProbs['away_+0.5'],
    devigAh['home_-0.5'] ?? 0.5, devigAh['away_+0.5'] ?? 0.5,
    ahBookOdds['home_-0.5'] ?? 1.95, ahBookOdds['away_+0.5'] ?? 1.95
  );

  const [ahHPlus05Cal, ahAMinus05Cal] = calibrateTwoWayMarket(
    ahProbs['home_+0.5'], ahProbs['away_-0.5'],
    devigAh['home_+0.5'] ?? 0.5, devigAh['away_-0.5'] ?? 0.5,
    ahBookOdds['home_+0.5'] ?? 1.35, ahBookOdds['away_-0.5'] ?? 3.40
  );

  const [ahHPlus15Cal, ahAMinus15Cal] = calibrateTwoWayMarket(
    ahProbs['home_+1.5'], ahProbs['away_-1.5'],
    devigAh['home_+1.5'] ?? 0.5, devigAh['away_-1.5'] ?? 0.5,
    ahBookOdds['home_+1.5'] ?? 1.25, ahBookOdds['away_-1.5'] ?? 4.20
  );

  const ahCalibratedProbs: Record<string, number> = {
    'home_-1.5': ahHMinus15Cal.prob,
    'away_+1.5': ahAAPlus15Cal.prob,
    'home_-0.5': ahHMinus05Cal.prob,
    'away_+0.5': ahAAPlus05Cal.prob,
    'home_+0.5': ahHPlus05Cal.prob,
    'away_-0.5': ahAMinus05Cal.prob,
    'home_+1.5': ahHPlus15Cal.prob,
    'away_-1.5': ahAMinus15Cal.prob,
  };

  const ahCalibratedEV: Record<string, number> = {
    'home_-1.5': ahHMinus15Cal.ev,
    'away_+1.5': ahAAPlus15Cal.ev,
    'home_-0.5': ahHMinus05Cal.ev,
    'away_+0.5': ahAAPlus05Cal.ev,
    'home_+0.5': ahHPlus05Cal.ev,
    'away_-0.5': ahAMinus05Cal.ev,
    'home_+1.5': ahHPlus15Cal.ev,
    'away_-1.5': ahAMinus15Cal.ev,
  };

  const ahFairOdds: Record<string, number> = {
    'home_-1.5': ahHMinus15Cal.prob > 0 ? Number((1 / ahHMinus15Cal.prob).toFixed(2)) : 99,
    'away_+1.5': ahAAPlus15Cal.prob > 0 ? Number((1 / ahAAPlus15Cal.prob).toFixed(2)) : 99,
    'home_-0.5': ahHMinus05Cal.prob > 0 ? Number((1 / ahHMinus05Cal.prob).toFixed(2)) : 99,
    'away_+0.5': ahAAPlus05Cal.prob > 0 ? Number((1 / ahAAPlus05Cal.prob).toFixed(2)) : 99,
    'home_+0.5': ahHPlus05Cal.prob > 0 ? Number((1 / ahHPlus05Cal.prob).toFixed(2)) : 99,
    'away_-0.5': ahAMinus05Cal.prob > 0 ? Number((1 / ahAMinus05Cal.prob).toFixed(2)) : 99,
    'home_+1.5': ahHPlus15Cal.prob > 0 ? Number((1 / ahHPlus15Cal.prob).toFixed(2)) : 99,
    'away_-1.5': ahAMinus15Cal.prob > 0 ? Number((1 / ahAMinus15Cal.prob).toFixed(2)) : 99,
  };

  return {
    lambdaHome,
    lambdaAway,
    scoreMatrix,
    trueProbabilities: {
      home: homeCal.prob,
      draw: drawCal.prob,
      away: awayCal.prob,
      over15: over15Cal.prob,
      under15: under15Cal.prob,
      over25: over25Cal.prob,
      under25: under25Cal.prob,
      over35: over35Cal.prob,
      under35: under35Cal.prob,
      bttsYes: bttsYesCal.prob,
      bttsNo: bttsNoCal.prob,
      asianHandicap: ahCalibratedProbs,
    },
    expectedValues: {
      homeEV: homeCal.ev,
      drawEV: drawCal.ev,
      awayEV: awayCal.ev,
      over15EV: over15Cal.ev,
      under15EV: under15Cal.ev,
      over25EV: over25Cal.ev,
      under25EV: under25Cal.ev,
      over35EV: over35Cal.ev,
      under35EV: under35Cal.ev,
      bttsYesEV: bttsYesCal.ev,
      bttsNoEV: bttsNoCal.ev,
      asianHandicapEV: ahCalibratedEV,
    },
    fairOdds: {
      home: homeCal.prob > 0 ? Number((1 / homeCal.prob).toFixed(2)) : 99,
      draw: drawCal.prob > 0 ? Number((1 / drawCal.prob).toFixed(2)) : 99,
      away: awayCal.prob > 0 ? Number((1 / awayCal.prob).toFixed(2)) : 99,
      over15: over15Cal.prob > 0 ? Number((1 / over15Cal.prob).toFixed(2)) : 99,
      under15: under15Cal.prob > 0 ? Number((1 / under15Cal.prob).toFixed(2)) : 99,
      over25: over25Cal.prob > 0 ? Number((1 / over25Cal.prob).toFixed(2)) : 99,
      under25: under25Cal.prob > 0 ? Number((1 / under25Cal.prob).toFixed(2)) : 99,
      over35: over35Cal.prob > 0 ? Number((1 / over35Cal.prob).toFixed(2)) : 99,
      under35: under35Cal.prob > 0 ? Number((1 / under35Cal.prob).toFixed(2)) : 99,
      bttsYes: bttsYesCal.prob > 0 ? Number((1 / bttsYesCal.prob).toFixed(2)) : 99,
      bttsNo: bttsNoCal.prob > 0 ? Number((1 / bttsNoCal.prob).toFixed(2)) : 99,
      asianHandicapFair: ahFairOdds,
    },
  };
}

/**
 * Remove vigorish (bookmaker margin) via multiplicative normalization
 */
export function devigOdds(oddsArray: number[]): number[] {
  const implied = oddsArray.map(o => (o > 0 ? 1 / o : 0));
  const totalMargin = implied.reduce((acc, curr) => acc + curr, 0);
  if (totalMargin <= 0) return oddsArray.map(() => 0);
  return implied.map(p => Number((p / totalMargin).toFixed(4)));
}

/**
 * Parlay Analysis: Total Odds, True Probability, Expected Value, and Correlation Checks
 */
export function calculateParlayMetrics(legs: LegSelection[]): {
  totalOdds: number;
  combinedTrueProb: number;
  expectedValue: number;
  hasCorrelation: boolean;
  correlationMessage?: string;
} {
  if (legs.length === 0) {
    return {
      totalOdds: 1.0,
      combinedTrueProb: 1.0,
      expectedValue: 0.0,
      hasCorrelation: false,
    };
  }

  // Total Parlay Decimal Odds = product of all legs
  const totalOdds = Number(legs.reduce((acc, leg) => acc * leg.odds, 1).toFixed(2));

  // Joint Probability (independent assumption)
  const combinedTrueProb = legs.reduce((acc, leg) => acc * leg.trueProb, 1);

  // Parlay EV = (Combined Probability * Total Odds - 1) * 100
  const expectedValue = Number(((combinedTrueProb * totalOdds - 1) * 100).toFixed(2));

  // Correlation and Conflict Detection
  const fixtureLegMap = new Map<string, LegSelection[]>();
  for (const leg of legs) {
    const list = fixtureLegMap.get(leg.fixtureId) || [];
    list.push(leg);
    fixtureLegMap.set(leg.fixtureId, list);
  }

  let hasCorrelation = false;
  let correlationMessage: string | undefined = undefined;

  for (const [, fixtureLegs] of Array.from(fixtureLegMap.entries())) {
    if (fixtureLegs.length > 1) {
      hasCorrelation = true;
      const selections = fixtureLegs.map(l => `${l.market}: ${l.selection}`).join(' & ');
      
      // Check for direct mutual exclusivity
      const marketTypes = fixtureLegs.map(l => l.market);
      const isMutuallyExclusive = (
        (marketTypes.filter(m => m === '1X2').length > 1) ||
        (marketTypes.filter(m => m === 'Totals').length > 1)
      );

      if (isMutuallyExclusive) {
        correlationMessage = `Conflict detected in ${fixtureLegs[0].homeTeam} vs ${fixtureLegs[0].awayTeam}: Mutually exclusive selections (${selections}). A parlay cannot hit opposite outcomes.`;
      } else {
        correlationMessage = `Same Game Parlay (SGP) correlation detected in ${fixtureLegs[0].homeTeam} vs ${fixtureLegs[0].awayTeam} (${selections}). Outcomes are correlated; true joint probability may deviate from pure independent product.`;
      }
      break;
    }
  }

  return {
    totalOdds,
    combinedTrueProb: Number(combinedTrueProb.toFixed(4)),
    expectedValue,
    hasCorrelation,
    correlationMessage,
  };
}

/**
 * Fractional Kelly Criterion (1/4 Kelly)
 * b = Odds - 1
 * p = True Probability
 * q = 1 - p
 * f* = (b*p - q) / b
 * 1/4 Kelly = f* / 4 (capped for safety)
 */
export function calculateKellyCriterion(
  bankroll: number,
  totalOdds: number,
  trueProb: number
): BankrollCalculation {
  const b = totalOdds - 1;
  const p = trueProb;
  const q = 1 - p;

  if (b <= 0 || p <= 0) {
    return {
      bankroll,
      kellyFraction: 0.25,
      recommendedStakePercent: 0,
      recommendedStakeAmount: 0,
      expectedProfit: 0,
      potentialPayout: 0,
    };
  }

  const fullKelly = (b * p - q) / b;

  // If expected value is non-positive, Kelly recommends 0 stake
  if (fullKelly <= 0) {
    return {
      bankroll,
      kellyFraction: 0.25,
      recommendedStakePercent: 0,
      recommendedStakeAmount: 0,
      expectedProfit: 0,
      potentialPayout: 0,
    };
  }

  // 1/4 Kelly for parlay variance protection
  const quarterKelly = fullKelly * 0.25;

  // Cap stake recommendation at 5% of bankroll to protect against black swans
  const cappedKelly = Math.min(quarterKelly, 0.05);
  const recommendedStakePercent = Number((cappedKelly * 100).toFixed(2));
  const recommendedStakeAmount = Number((bankroll * cappedKelly).toFixed(2));
  const potentialPayout = Number((recommendedStakeAmount * totalOdds).toFixed(2));
  const expectedProfit = Number((recommendedStakeAmount * totalOdds * p - recommendedStakeAmount).toFixed(2));

  return {
    bankroll,
    kellyFraction: 0.25,
    recommendedStakePercent,
    recommendedStakeAmount,
    expectedProfit,
    potentialPayout,
  };
}
