import { Fixture, MarketOdds, QuantMatchAnalysis } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';

/**
 * Synthetic Fair Odds Generator
 * Used as high-fidelity fallback when The Odds API quota is exhausted (requests <= 0 or HTTP 429).
 * Derives consensus bookmaker market odds from Poisson true probabilities with a standard 4% margin
 * and realistic micro-variance.
 */
export function generateSyntheticMarketOdds(
  fixture: Fixture,
  quantOverride?: QuantMatchAnalysis,
  margin = 0.04 // 4% standard Pinnacle/Bet365 market margin
): MarketOdds {
  const qa = quantOverride || fixture.quantAnalysis || analyzeFixtureQuant(fixture);
  const probs = qa.trueProbabilities;

  // Deterministic micro-variance based on fixture ID
  const hash = fixture.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variance = (factor: number) => {
    const delta = (((hash * factor) % 7) - 3) * 0.005; // -0.015 to +0.015
    return 1 + delta;
  };

  const probToOdd = (p: number, vFactor = 1): number => {
    if (p <= 0.02) return 25.0;
    if (p >= 0.98) return 1.03;
    // Market implied prob with margin: p_market = p_true * (1 + margin)
    const pMarket = Math.min(0.98, p * (1 + margin) * variance(vFactor));
    const rawOdd = 1 / pMarket;
    return Number(Math.max(1.04, Math.min(25.0, rawOdd)).toFixed(2));
  };

  // 1X2 Market
  const home_odds = probToOdd(probs.home, 11);
  const draw_odds = probToOdd(probs.draw, 17);
  const away_odds = probToOdd(probs.away, 23);

  // Totals Market
  const over_15_odds = probToOdd(probs.over15, 31);
  const under_15_odds = probToOdd(probs.under15, 37);
  const over_25_odds = probToOdd(probs.over25, 41);
  const under_25_odds = probToOdd(probs.under25, 43);
  const over_35_odds = probToOdd(probs.over35, 47);
  const under_35_odds = probToOdd(probs.under35, 53);

  // BTTS Market
  const btts_yes_odds = probToOdd(probs.bttsYes, 59);
  const btts_no_odds = probToOdd(probs.bttsNo, 61);

  // Asian Handicap Market
  const handicap_odds: Record<string, number> = {
    'home_-1.5': probToOdd(probs.asianHandicap['home_-1.5'] || 0.25, 71),
    'away_+1.5': probToOdd(probs.asianHandicap['away_+1.5'] || 0.75, 73),
    'home_-0.5': home_odds,
    'away_+0.5': probToOdd(probs.asianHandicap['away_+0.5'] || 0.50, 79),
    'home_+0.5': probToOdd(probs.asianHandicap['home_+0.5'] || 0.65, 83),
    'away_-0.5': away_odds,
    'home_+1.5': probToOdd(probs.asianHandicap['home_+1.5'] || 0.80, 89),
    'away_-1.5': probToOdd(probs.asianHandicap['away_-1.5'] || 0.20, 97),
  };

  const totals_odds: Record<string, number> = {
    'over_1.5': over_15_odds,
    'under_1.5': under_15_odds,
    'over_2.5': over_25_odds,
    'under_2.5': under_25_odds,
    'over_3.5': over_35_odds,
    'under_3.5': under_35_odds,
  };

  const btts_odds: Record<string, number> = {
    'btts_yes': btts_yes_odds,
    'btts_no': btts_no_odds,
  };

  return {
    fixture_id: fixture.id,
    bookmaker: 'Pinnacle Consensus (Synthetic Fair)',
    home_odds,
    draw_odds,
    away_odds,
    over_25_odds,
    under_25_odds,
    handicap_odds,
    totals_odds,
    btts_odds,
    is_positive_ev: qa.expectedValues.homeEV > 0 || qa.expectedValues.awayEV > 0 || qa.expectedValues.over25EV > 0,
    ev_home: qa.expectedValues.homeEV,
    ev_draw: qa.expectedValues.drawEV,
    ev_away: qa.expectedValues.awayEV,
    max_ev: Math.max(
      qa.expectedValues.homeEV,
      qa.expectedValues.drawEV,
      qa.expectedValues.awayEV,
      qa.expectedValues.over25EV,
      qa.expectedValues.under25EV
    ),
    updated_at: new Date().toISOString(),
  };
}
