import { createServerClient } from '@/lib/supabase/server';
import { Fixture, AIParlay, Team, MarketOdds } from '@/types';
import { MOCK_FIXTURES, MOCK_HISTORICAL_PARLAYS, MOCK_TEAMS } from '@/lib/mock-data';
import { analyzeFixtureQuant } from '@/lib/analytics';

export async function getOddsMatrixData(): Promise<{
  fixtures: Fixture[];
  parlays: AIParlay[];
  source: 'supabase' | 'mock_fallback';
}> {
  const supabase = createServerClient();

  if (!supabase) {
    return {
      fixtures: MOCK_FIXTURES.map(f => ({
        ...f,
        quantAnalysis: analyzeFixtureQuant(f),
      })),
      parlays: MOCK_HISTORICAL_PARLAYS,
      source: 'mock_fallback',
    };
  }

  try {
    // 1. Fetch teams, fixtures, and market odds from Supabase concurrently
    const [teamsRes, fixturesRes, oddsRes, parlaysRes] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('fixtures').select('*').order('match_time', { ascending: true }),
      supabase.from('market_odds').select('*'),
      supabase.from('ai_parlays').select('*').order('created_at', { ascending: false }),
    ]);

    const teams = (teamsRes.data as Team[]) || [];
    const fixturesRaw = fixturesRes.data || [];
    const odds = (oddsRes.data as MarketOdds[]) || [];
    const parlaysRaw = (parlaysRes.data as any[]) || [];

    // If no fixtures in Supabase, fall back to mock data
    if (fixturesRaw.length === 0) {
      return {
        fixtures: MOCK_FIXTURES.map(f => ({
          ...f,
          quantAnalysis: analyzeFixtureQuant(f),
        })),
        parlays: MOCK_HISTORICAL_PARLAYS,
        source: 'mock_fallback',
      };
    }

    // Build lookup maps
    const teamMap = new Map<string, Team>();
    for (const t of teams) {
      teamMap.set(t.id, t);
    }
    // Also add fallback mock teams in case any ID wasn't in teams table
    for (const [id, t] of Object.entries(MOCK_TEAMS)) {
      if (!teamMap.has(id)) {
        teamMap.set(id, t);
      }
    }

    const oddsMap = new Map<string, MarketOdds>();
    for (const o of odds) {
      oddsMap.set(o.fixture_id, o);
    }

    // Assemble fixtures
    const fixtures: Fixture[] = fixturesRaw.map((f: any) => {
      const homeTeam = teamMap.get(f.home_team_id) || {
        id: f.home_team_id,
        league: f.league,
        name: f.home_team_id,
        aliases: [],
        attack_rating: 1.15,
        defense_rating: 0.95,
        form: 'N/A',
        crest_url: MOCK_TEAMS[f.home_team_id]?.crest_url,
      };

      const awayTeam = teamMap.get(f.away_team_id) || {
        id: f.away_team_id,
        league: f.league,
        name: f.away_team_id,
        aliases: [],
        attack_rating: 1.05,
        defense_rating: 1.05,
        form: 'N/A',
        crest_url: MOCK_TEAMS[f.away_team_id]?.crest_url,
      };

      const fallbackHomeForm = homeTeam.form && homeTeam.form !== 'N/A' 
        ? homeTeam.form 
        : (MOCK_TEAMS[f.home_team_id]?.form || 'WDLWW');
      const fallbackAwayForm = awayTeam.form && awayTeam.form !== 'N/A' 
        ? awayTeam.form 
        : (MOCK_TEAMS[f.away_team_id]?.form || 'DWDWL');

      homeTeam.form = fallbackHomeForm;
      awayTeam.form = fallbackAwayForm;

      const fallbackMockOdds = MOCK_FIXTURES.find(mf => mf.id === f.id)?.marketOdds;
      const dbOdds = oddsMap.get(f.id);

      const marketOdds: MarketOdds = dbOdds || fallbackMockOdds || {
        fixture_id: f.id,
        bookmaker: 'Pinnacle Consensus',
        home_odds: 2.0,
        draw_odds: 3.2,
        away_odds: 3.5,
        over_25_odds: 1.85,
        under_25_odds: 1.95,
      };

      if (!marketOdds.handicap_odds && fallbackMockOdds?.handicap_odds) {
        marketOdds.handicap_odds = fallbackMockOdds.handicap_odds;
      }
      if (!marketOdds.totals_odds && fallbackMockOdds?.totals_odds) {
        marketOdds.totals_odds = fallbackMockOdds.totals_odds;
      }
      if (!marketOdds.btts_odds && fallbackMockOdds?.btts_odds) {
        marketOdds.btts_odds = fallbackMockOdds.btts_odds;
      }

      const fixtureObj: Fixture = {
        id: f.id,
        league: f.league,
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        match_time: f.match_time,
        status: f.status || 'SCHEDULED',
        homeTeam,
        awayTeam,
        marketOdds,
      };

      fixtureObj.quantAnalysis = analyzeFixtureQuant(fixtureObj);
      return fixtureObj;
    });

    // Parse AI parlays
    let parlays: AIParlay[] = [];
    if (parlaysRaw.length > 0) {
      parlays = parlaysRaw.map((p: any) => {
        let legs = p.legs;
        if (typeof legs === 'string') {
          try {
            legs = JSON.parse(legs);
          } catch {
            legs = [];
          }
        }
        return {
          id: p.id,
          category: p.category,
          title: p.title || `${p.category.toUpperCase()} Slip`,
          description: p.description || `Expected Value +${p.expected_value}%`,
          legs: Array.isArray(legs) ? legs : [],
          total_odds: Number(p.total_odds),
          true_probability: Number(p.true_probability),
          expected_value: Number(p.expected_value),
          status: p.status || 'pending',
          created_at: p.created_at || new Date().toISOString(),
        };
      });
    } else {
      parlays = MOCK_HISTORICAL_PARLAYS;
    }

    return {
      fixtures,
      parlays,
      source: 'supabase',
    };
  } catch (error) {
    console.error('Error fetching live data from Supabase, falling back to mock:', error);
    return {
      fixtures: MOCK_FIXTURES.map(f => ({
        ...f,
        quantAnalysis: analyzeFixtureQuant(f),
      })),
      parlays: MOCK_HISTORICAL_PARLAYS,
      source: 'mock_fallback',
    };
  }
}
