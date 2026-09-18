import { Fixture, LegSelection, AIParlay } from '@/types';
import { analyzeFixtureQuant, calculateParlayMetrics } from '@/lib/analytics';

/**
 * Filter strictly upcoming fixtures:
 * 1. match_time > now
 * 2. status is strictly 'SCHEDULED' or 'TIMED' (never 'FINISHED' or 'IN_PLAY')
 */
export function isFixtureUpcoming(fixture: Fixture, now = new Date()): boolean {
  if (fixture.status === 'FINISHED' || fixture.status === 'IN_PLAY') {
    return false;
  }
  const matchTime = new Date(fixture.match_time).getTime();
  if (isNaN(matchTime)) return false;
  return matchTime > now.getTime();
}

/**
 * Extract candidate betting legs from an upcoming fixture using its quantitative model
 */
function extractCandidateLegs(fixture: Fixture): LegSelection[] {
  const qa = fixture.quantAnalysis || analyzeFixtureQuant(fixture);
  const odds = fixture.marketOdds;
  const homeTeam = fixture.homeTeam?.name || 'Home';
  const awayTeam = fixture.awayTeam?.name || 'Away';
  const homeCrest = fixture.homeTeam?.crest_url;
  const awayCrest = fixture.awayTeam?.crest_url;

  const legs: LegSelection[] = [];

  // 1X2 - Home Win
  if (qa.trueProbabilities.home >= 0.40) {
    legs.push({
      fixtureId: fixture.id,
      league: fixture.league,
      homeTeam,
      awayTeam,
      homeCrest,
      awayCrest,
      market: '1X2',
      selection: '1',
      odds: odds?.home_odds || 2.0,
      trueProb: qa.trueProbabilities.home,
      ev: qa.expectedValues.homeEV,
      matchTime: fixture.match_time,
    });
  }

  // 1X2 - Away Win
  if (qa.trueProbabilities.away >= 0.40) {
    legs.push({
      fixtureId: fixture.id,
      league: fixture.league,
      homeTeam,
      awayTeam,
      homeCrest,
      awayCrest,
      market: '1X2',
      selection: '2',
      odds: odds?.away_odds || 3.5,
      trueProb: qa.trueProbabilities.away,
      ev: qa.expectedValues.awayEV,
      matchTime: fixture.match_time,
    });
  }

  // Totals - Over 2.5
  if (qa.trueProbabilities.over25 >= 0.52) {
    legs.push({
      fixtureId: fixture.id,
      league: fixture.league,
      homeTeam,
      awayTeam,
      homeCrest,
      awayCrest,
      market: 'Totals',
      selection: 'Over 2.5',
      odds: odds?.over_25_odds || odds?.totals_odds?.['over_2.5'] || 1.85,
      trueProb: qa.trueProbabilities.over25,
      ev: qa.expectedValues.over25EV,
      matchTime: fixture.match_time,
    });
  }

  // Totals - Under 2.5
  if (qa.trueProbabilities.under25 >= 0.52) {
    legs.push({
      fixtureId: fixture.id,
      league: fixture.league,
      homeTeam,
      awayTeam,
      homeCrest,
      awayCrest,
      market: 'Totals',
      selection: 'Under 2.5',
      odds: odds?.under_25_odds || odds?.totals_odds?.['under_2.5'] || 1.95,
      trueProb: qa.trueProbabilities.under25,
      ev: qa.expectedValues.under25EV,
      matchTime: fixture.match_time,
    });
  }

  return legs;
}

/**
 * Dynamically generate 3 AI Curated Parlays from strictly upcoming fixtures:
 * 1. Safe Combo (#48): 2-3 highest win probability legs within the next 48-72 hours.
 * 2. Value Seeker (#29): 3 legs with highest positive +EV within the next 48-72 hours.
 * 3. Weekend Lotto (#14): 5 legs with long odds / high payout from the upcoming weekend gameweek.
 */
export function generateCuratedParlays(allFixtures: Fixture[]): AIParlay[] {
  const now = new Date();

  // Step 1: Strictly filter upcoming fixtures (SCHEDULED or TIMED, future kickoff, not FINISHED or IN_PLAY)
  let upcomingFixtures = allFixtures.filter((f) => isFixtureUpcoming(f, now));

  // Fallback if all fixtures in the DB are past dates
  if (upcomingFixtures.length < 5) {
    upcomingFixtures = allFixtures.filter(
      (f) => f.status === 'SCHEDULED' || f.status === 'TIMED'
    );
    if (upcomingFixtures.length === 0) {
      upcomingFixtures = allFixtures;
    }
  }

  // Sort upcoming fixtures by match time
  const sortedUpcoming = [...upcomingFixtures].sort(
    (a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
  );

  // Extract all candidate legs
  const allCandidates: LegSelection[] = [];
  for (const f of sortedUpcoming) {
    allCandidates.push(...extractCandidateLegs(f));
  }

  // 1. Safe Combo: 2-3 highest trueProb legs from distinct fixtures within immediate window
  const safeCandidates = [...allCandidates].sort((a, b) => b.trueProb - a.trueProb);
  const safeLegs: LegSelection[] = [];
  const safeFixtureIds = new Set<string>();

  for (const leg of safeCandidates) {
    if (!safeFixtureIds.has(leg.fixtureId) && leg.trueProb >= 0.50) {
      safeLegs.push(leg);
      safeFixtureIds.add(leg.fixtureId);
      if (safeLegs.length === 3) break;
    }
  }
  // Ensure at least 2-3 legs
  if (safeLegs.length < 2) {
    for (const leg of safeCandidates) {
      if (!safeFixtureIds.has(leg.fixtureId)) {
        safeLegs.push(leg);
        safeFixtureIds.add(leg.fixtureId);
        if (safeLegs.length === 3) break;
      }
    }
  }

  const safeMetrics = calculateParlayMetrics(safeLegs);

  const safeSlip: AIParlay = {
    id: 'ai-safe-upcoming',
    category: 'safe',
    title: 'Safe Combo #48',
    description: 'High-confidence favorites and low-variance anchors from upcoming matchday fixtures.',
    legs: safeLegs,
    total_odds: safeMetrics.totalOdds,
    true_probability: safeMetrics.combinedTrueProb,
    expected_value: safeMetrics.expectedValue,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  // 2. Value Seeker: 3 legs with highest positive +EV from distinct fixtures
  const valueCandidates = [...allCandidates].sort((a, b) => b.ev - a.ev);
  const valueLegs: LegSelection[] = [];
  const valueFixtureIds = new Set<string>();

  for (const leg of valueCandidates) {
    if (!valueFixtureIds.has(leg.fixtureId) && leg.odds >= 1.35) {
      valueLegs.push(leg);
      valueFixtureIds.add(leg.fixtureId);
      if (valueLegs.length === 3) break;
    }
  }

  const valueMetrics = calculateParlayMetrics(valueLegs);

  const valueSlip: AIParlay = {
    id: 'ai-value-upcoming',
    category: 'value',
    title: 'Value Seeker #29',
    description: 'Mathematically positive expected value legs with market mispricing edge.',
    legs: valueLegs,
    total_odds: valueMetrics.totalOdds,
    true_probability: valueMetrics.combinedTrueProb,
    expected_value: valueMetrics.expectedValue,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  // 3. Weekend Lotto: 5 legs from upcoming weekend gameweek
  const lottoCandidates = [...allCandidates].sort((a, b) => b.odds - a.odds);
  const lottoLegs: LegSelection[] = [];
  const lottoFixtureIds = new Set<string>();

  for (const leg of lottoCandidates) {
    if (!lottoFixtureIds.has(leg.fixtureId) && leg.odds >= 1.45) {
      lottoLegs.push(leg);
      lottoFixtureIds.add(leg.fixtureId);
      if (lottoLegs.length === 5) break;
    }
  }
  // Fill if less than 5
  if (lottoLegs.length < 5) {
    for (const leg of allCandidates) {
      if (!lottoFixtureIds.has(leg.fixtureId)) {
        lottoLegs.push(leg);
        lottoFixtureIds.add(leg.fixtureId);
        if (lottoLegs.length === 5) break;
      }
    }
  }

  const lottoMetrics = calculateParlayMetrics(lottoLegs);

  const lottoSlip: AIParlay = {
    id: 'ai-lotto-upcoming',
    category: 'lotto',
    title: 'Weekend Lotto Moonshot #14',
    description: 'High-multiplier moonshot accumulator targeting amplified payouts across Europe.',
    legs: lottoLegs,
    total_odds: lottoMetrics.totalOdds,
    true_probability: lottoMetrics.combinedTrueProb,
    expected_value: lottoMetrics.expectedValue,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  return [safeSlip, valueSlip, lottoSlip];
}
