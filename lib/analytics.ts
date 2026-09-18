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
 * Computes 6x6 score probability matrix (0-0 to 5-5) and derived true probabilities
 * using a Bivariate Poisson distribution.
 */
export function analyzeFixtureQuant(
  fixture: Fixture,
  leagueOverride?: LeagueInfo
): QuantMatchAnalysis {
  const league = leagueOverride || LEAGUES_DATA[fixture.league] || LEAGUES_DATA.PL;
  const homeTeam = fixture.homeTeam;
  const awayTeam = fixture.awayTeam;

  const homeAttack = homeTeam?.attack_rating ?? 1.15;
  const homeDefense = homeTeam?.defense_rating ?? 0.90;
  const awayAttack = awayTeam?.attack_rating ?? 1.05;
  const awayDefense = awayTeam?.defense_rating ?? 1.05;

  // Expected goals: lambda_home = league_avg_home * home_attack * away_defense
  // Expected goals: lambda_away = league_avg_away * away_attack * home_defense
  const lambdaHome = Math.max(0.2, Number((league.avgHomeGoals * homeAttack * awayDefense).toFixed(3)));
  const lambdaAway = Math.max(0.2, Number((league.avgAwayGoals * awayAttack * homeDefense).toFixed(3)));

  // Generate 6x6 score matrix (scores 0 to 5 for each team)
  const matrixSize = 6;
  const rawMatrix: number[][] = [];
  let totalProbSum = 0;

  for (let h = 0; h < matrixSize; h++) {
    rawMatrix[h] = [];
    for (let a = 0; a < matrixSize; a++) {
      const p = poissonPMF(h, lambdaHome) * poissonPMF(a, lambdaAway);
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

  // Calculate True Probabilities
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  let over25Prob = 0;
  let under25Prob = 0;
  let bttsYesProb = 0;

  for (let h = 0; h < matrixSize; h++) {
    for (let a = 0; a < matrixSize; a++) {
      const p = scoreMatrix[h][a];
      if (h > a) homeWinProb += p;
      else if (h === a) drawProb += p;
      else awayWinProb += p;

      if (h + a > 2.5) over25Prob += p;
      else under25Prob += p;

      if (h >= 1 && a >= 1) bttsYesProb += p;
    }
  }

  const bttsNoProb = 1 - bttsYesProb;

  // Expected Value calculation with market odds
  const odds = fixture.marketOdds;
  const homeOdds = odds?.home_odds ?? 2.0;
  const drawOdds = odds?.draw_odds ?? 3.2;
  const awayOdds = odds?.away_odds ?? 3.5;
  const overOdds = odds?.over_25_odds ?? 1.85;
  const underOdds = odds?.under_25_odds ?? 1.95;

  const calculateEV = (trueProb: number, bookOdds: number) => {
    return Number(((trueProb * bookOdds - 1) * 100).toFixed(2));
  };

  const homeEV = calculateEV(homeWinProb, homeOdds);
  const drawEV = calculateEV(drawProb, drawOdds);
  const awayEV = calculateEV(awayWinProb, awayOdds);
  const over25EV = calculateEV(over25Prob, overOdds);
  const under25EV = calculateEV(under25Prob, underOdds);

  return {
    lambdaHome,
    lambdaAway,
    scoreMatrix,
    trueProbabilities: {
      home: Number(homeWinProb.toFixed(4)),
      draw: Number(drawProb.toFixed(4)),
      away: Number(awayWinProb.toFixed(4)),
      over25: Number(over25Prob.toFixed(4)),
      under25: Number(under25Prob.toFixed(4)),
      bttsYes: Number(bttsYesProb.toFixed(4)),
      bttsNo: Number(bttsNoProb.toFixed(4)),
    },
    expectedValues: {
      homeEV,
      drawEV,
      awayEV,
      over25EV,
      under25EV,
    },
    fairOdds: {
      home: homeWinProb > 0 ? Number((1 / homeWinProb).toFixed(2)) : 99,
      draw: drawProb > 0 ? Number((1 / drawProb).toFixed(2)) : 99,
      away: awayWinProb > 0 ? Number((1 / awayWinProb).toFixed(2)) : 99,
      over25: over25Prob > 0 ? Number((1 / over25Prob).toFixed(2)) : 99,
      under25: under25Prob > 0 ? Number((1 / under25Prob).toFixed(2)) : 99,
    }
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
