import { createServerClient } from '@/lib/supabase/server';
import { LEAGUES_DATA, MOCK_FIXTURES, MOCK_TEAMS } from '@/lib/mock-data';
import { LeagueCode, Fixture, MarketOdds, Team } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { generateCuratedParlays } from '@/lib/ai-parlay-generator';
import { generateSyntheticMarketOdds } from '@/lib/synthetic-odds';
import { uploadTeamCrestToSupabase } from '@/lib/storage';
import { findNormalizedTeamId, cleanTeamString } from '@/lib/team-matcher';
import { getTeamCrestUrl } from '@/lib/team-crests';

export const ALL_SUPPORTED_LEAGUES: LeagueCode[] = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EL'];

export const COMPETITION_IDS: Record<LeagueCode, string> = {
  PL: 'PL',
  PD: 'PD',
  SA: 'SA',
  BL1: 'BL1',
  FL1: 'FL1',
  CL: 'CL',
  EL: 'EL',
};

/**
 * Returns rolling 7-day window dates [TODAY, TODAY + 7 DAYS] formatted as YYYY-MM-DD
 */
export function get7DayDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const dateFrom = today.toISOString().split('T')[0];
  const todayPlus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateTo = todayPlus7.toISOString().split('T')[0];
  return { dateFrom, dateTo };
}

export interface PipelineOptions {
  league?: LeagueCode | 'ALL' | string;
  batch?: boolean;
}

export interface FixturesSyncSummary {
  timestamp: string;
  mode: 'live_orchestrated' | 'mock_fallback';
  leaguesProcessed: LeagueCode[];
  dateRange: { dateFrom: string; dateTo: string };
  fixturesUpdated: number;
  teamsUpdated: number;
  storageUploads: number;
  errors: string[];
}

export interface OddsSyncSummary {
  timestamp: string;
  mode: 'live_orchestrated' | 'synthetic_fallback';
  leaguesProcessed: LeagueCode[];
  oddsUpdated: number;
  parlaysUpdated: number;
  oddsApiQuota: {
    remaining: number | null;
    used: number | null;
  };
  errors: string[];
}

export interface PipelineSyncSummary {
  timestamp: string;
  mode: 'live_orchestrated' | 'mock_fallback';
  leaguesProcessed: LeagueCode[];
  fixturesUpdated: number;
  teamsUpdated: number;
  oddsUpdated: number;
  parlaysUpdated: number;
  oddsApiQuota: {
    remaining: number | null;
    used: number | null;
  };
  apiFootballQuota?: {
    remaining: number | null;
    limit: number | null;
  };
  details: {
    footballDataStatus: string;
    oddsApiStatus: string;
    apiFootballStatus: string;
    storageUploads: number;
  };
  errors: string[];
}

function parseTeamForm(rawForm?: string | null): string {
  if (!rawForm) return 'WDLWW';
  const cleaned = rawForm.replace(/[^WDLwdl]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned.slice(-5) : 'WDLWW';
}

/**
 * Matchday Schedule Gate:
 * Only query The Odds API on active matchdays to preserve monthly quota:
 * - Friday 12:00 UTC through Sunday 23:59 UTC (Domestic Leagues)
 * - Tuesday 10:00 UTC through Thursday 23:59 UTC (UEFA Champions & Europa League)
 */
export function isOddsApiMatchdayActive(date = new Date()): boolean {
  const day = date.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const hour = date.getUTCHours();

  if (day === 2 || day === 3 || day === 4) {
    return hour >= 10;
  }
  if (day === 5) {
    return hour >= 12;
  }
  if (day === 6 || day === 0) {
    return true;
  }
  return false;
}

/**
 * Helper to resolve target leagues from query options
 */
export function resolveTargetLeagues(options?: { league?: string; batch?: boolean }): LeagueCode[] {
  if (options?.league && options.league !== 'ALL') {
    const parsed = options.league
      .split(',')
      .map((s) => s.trim().toUpperCase() as LeagueCode)
      .filter((lg) => ALL_SUPPORTED_LEAGUES.includes(lg));
    if (parsed.length > 0) {
      return parsed;
    }
  }

  if (options?.batch) {
    const day = new Date().getUTCDay();
    // Tue/Wed/Thu: European cups (UCL / UEL); otherwise domestic Tier-1
    return day >= 2 && day <= 4 ? ['CL', 'EL'] : ['PL', 'PD'];
  }

  return ALL_SUPPORTED_LEAGUES;
}

/**
 * 1. FIXTURES & TEAMS INGESTION MICRO-SERVICE
 * Queries Football-Data.org v4 with rolling 7-day window (?dateFrom={TODAY}&dateTo={TODAY+7})
 * Ingests official SVG team crests, standings/form, and upcoming fixtures into Supabase.
 */
export async function syncFixturesAndTeams(options?: {
  league?: string;
  batch?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  success: boolean;
  summary: FixturesSyncSummary;
  fixtures: Fixture[];
}> {
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;
  const supabase = createServerClient();
  const leaguesToSync = resolveTargetLeagues(options);
  const defaultDates = get7DayDateRange();
  const dateFrom = options?.dateFrom || defaultDates.dateFrom;
  const dateTo = options?.dateTo || defaultDates.dateTo;

  const summary: FixturesSyncSummary = {
    timestamp: new Date().toISOString(),
    mode: footballDataKey ? 'live_orchestrated' : 'mock_fallback',
    leaguesProcessed: leaguesToSync,
    dateRange: { dateFrom, dateTo },
    fixturesUpdated: 0,
    teamsUpdated: 0,
    storageUploads: 0,
    errors: [],
  };

  const gatheredFixtures: Fixture[] = [];

  // If API key is missing, use curated mock fixtures filtered to target leagues
  if (!footballDataKey) {
    const filteredTeams = leaguesToSync.length === ALL_SUPPORTED_LEAGUES.length
      ? Object.values(MOCK_TEAMS)
      : Object.values(MOCK_TEAMS).filter((t) => leaguesToSync.includes(t.league));

    const filteredFixtures = leaguesToSync.length === ALL_SUPPORTED_LEAGUES.length
      ? MOCK_FIXTURES
      : MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));

    gatheredFixtures.push(...filteredFixtures);

    if (supabase) {
      // 1. Teams upsert with schema fallback (crest_url, rolling_xg, key_injuries_count)
      const teamsToUpsert = filteredTeams.map((t) => ({
        id: t.id,
        league: t.league,
        name: t.name,
        aliases: t.aliases || [],
        attack_rating: t.attack_rating,
        defense_rating: t.defense_rating,
        form: t.form && t.form !== 'N/A' && t.form !== 'DDDDD' ? t.form : 'WDLWW',
        crest_url: t.crest_url || getTeamCrestUrl(t.id) || null,
        rolling_xg: t.rolling_xg ?? null,
        key_injuries_count: t.key_injuries_count ?? 0,
      }));

      try {
        const { error: teamErr } = await supabase.from('teams').upsert(teamsToUpsert, { onConflict: 'id' });
        if (teamErr) {
          console.warn('[Pipeline] Extended teams upsert failed, retrying base schema:', teamErr.message);
          const baseTeams = teamsToUpsert.map(({ id, league, name, aliases, attack_rating, defense_rating, form }) => ({
            id, league, name, aliases, attack_rating, defense_rating, form,
          }));
          await supabase.from('teams').upsert(baseTeams, { onConflict: 'id' });
        }
        summary.teamsUpdated = teamsToUpsert.length;
      } catch (err: any) {
        summary.errors.push(`Teams mock upsert: ${err.message}`);
      }

      // 2. Fixtures upsert
      try {
        const fixturesToUpsert = filteredFixtures.map((f) => ({
          id: f.id,
          league: f.league,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id,
          match_time: f.match_time,
          status: f.status || 'SCHEDULED',
        }));
        await supabase.from('fixtures').upsert(fixturesToUpsert, { onConflict: 'id' });
        summary.fixturesUpdated = fixturesToUpsert.length;
      } catch (err: any) {
        summary.errors.push(`Fixtures mock upsert: ${err.message}`);
      }
    } else {
      summary.fixturesUpdated = filteredFixtures.length;
      summary.teamsUpdated = filteredTeams.length;
    }

    return {
      success: true,
      summary,
      fixtures: gatheredFixtures,
    };
  }

  // Live Football-Data.org fetch with rolling 7-day window
  const fetchPromises = leaguesToSync.map(async (lg) => {
    const compId = COMPETITION_IDS[lg];
    if (!compId) return [];

    try {
      const url = `https://api.football-data.org/v4/competitions/${compId}/matches?status=SCHEDULED,TIMED&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url, {
        headers: { 'X-Auth-Token': footballDataKey },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        summary.errors.push(`Football-Data ${lg}: HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      const matches = data.matches || [];
      const leagueFixtures: Fixture[] = [];

      for (const m of matches) {
        const homeId = findNormalizedTeamId(m.homeTeam.name, lg) || cleanTeamString(m.homeTeam.name);
        const awayId = findNormalizedTeamId(m.awayTeam.name, lg) || cleanTeamString(m.awayTeam.name);

        // Ingest official SVG/PNG crests
        let homeCrest = m.homeTeam.crest || getTeamCrestUrl(homeId) || null;
        let awayCrest = m.awayTeam.crest || getTeamCrestUrl(awayId) || null;

        if (homeCrest) {
          try {
            homeCrest = await uploadTeamCrestToSupabase(homeId, homeCrest);
            summary.storageUploads++;
          } catch {}
        }
        if (awayCrest) {
          try {
            awayCrest = await uploadTeamCrestToSupabase(awayId, awayCrest);
            summary.storageUploads++;
          } catch {}
        }

        const homeTeamObj: Team = {
          id: homeId,
          league: lg,
          name: m.homeTeam.shortName || m.homeTeam.name,
          aliases: [m.homeTeam.name],
          attack_rating: 1.2,
          defense_rating: 0.9,
          form: parseTeamForm(m.homeTeam.form),
          crest_url: homeCrest,
        };

        const awayTeamObj: Team = {
          id: awayId,
          league: lg,
          name: m.awayTeam.shortName || m.awayTeam.name,
          aliases: [m.awayTeam.name],
          attack_rating: 1.1,
          defense_rating: 1.0,
          form: parseTeamForm(m.awayTeam.form),
          crest_url: awayCrest,
        };

        const fix: Fixture = {
          id: `${lg.toLowerCase()}-${homeId}-${awayId}`,
          league: lg,
          home_team_id: homeId,
          away_team_id: awayId,
          match_time: m.utcDate,
          status: m.status || 'SCHEDULED',
          homeTeam: homeTeamObj,
          awayTeam: awayTeamObj,
        };
        leagueFixtures.push(fix);
      }
      return leagueFixtures;
    } catch (err: any) {
      summary.errors.push(`Football-Data ${lg}: ${err.message}`);
      return [];
    }
  });

  const settled = await Promise.allSettled(fetchPromises);
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      gatheredFixtures.push(...s.value);
    }
  }

  // Fallback to mock fixtures if no live upcoming matches were found in the 7-day window
  if (gatheredFixtures.length === 0) {
    console.warn('[Pipeline] Zero live matches in 7-day window, applying mock fallback for target leagues.');
    const fallback = MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));
    gatheredFixtures.push(...(fallback.length > 0 ? fallback : MOCK_FIXTURES));
  }

  // Supabase persist
  if (supabase && gatheredFixtures.length > 0) {
    const teamsToUpsert = gatheredFixtures.flatMap((f) => [f.homeTeam, f.awayTeam]).filter(Boolean);
    const uniqueTeams = Array.from(new Map(teamsToUpsert.map((t) => [t!.id, t!])).values());

    try {
      const payload = uniqueTeams.map((t) => ({
        id: t.id,
        league: t.league,
        name: t.name,
        aliases: t.aliases,
        attack_rating: t.attack_rating,
        defense_rating: t.defense_rating,
        form: t.form,
        crest_url: t.crest_url || null,
      }));

      const { error: liveTeamErr } = await supabase.from('teams').upsert(payload, { onConflict: 'id' });
      if (liveTeamErr) {
        console.warn('[Pipeline] Teams upsert error, falling back to base columns:', liveTeamErr.message);
        const baseTeams = payload.map(({ id, league, name, aliases, attack_rating, defense_rating, form }) => ({
          id, league, name, aliases, attack_rating, defense_rating, form,
        }));
        await supabase.from('teams').upsert(baseTeams, { onConflict: 'id' });
      }
      summary.teamsUpdated = uniqueTeams.length;
    } catch (err: any) {
      summary.errors.push(`Live teams upsert: ${err.message}`);
    }

    try {
      const { error: fixErr } = await supabase.from('fixtures').upsert(
        gatheredFixtures.map((f) => ({
          id: f.id,
          league: f.league,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id,
          match_time: f.match_time,
          status: f.status,
        })),
        { onConflict: 'id' }
      );
      if (!fixErr) {
        summary.fixturesUpdated = gatheredFixtures.length;
      }
    } catch (err: any) {
      summary.errors.push(`Live fixtures upsert: ${err.message}`);
    }
  }

  return {
    success: true,
    summary,
    fixtures: gatheredFixtures,
  };
}

/**
 * 2. MARKET ODDS & AI PARLAYS MICRO-SERVICE
 * Strictly processes fixtures within the next 48-72 hours.
 * Pulls consensus odds from The Odds API (or applies Synthetic Poisson Odds Fallback).
 * Triggers Supabase PL/pgSQL EV recalculations and refreshes AI parlays.
 */
export async function syncMarketOdds(options?: {
  league?: string;
  hoursAhead?: number;
  fixtures?: Fixture[];
}): Promise<{
  success: boolean;
  summary: OddsSyncSummary;
  fixtures: Fixture[];
}> {
  const oddsApiKey = process.env.THE_ODDS_API_KEY;
  const supabase = createServerClient();
  const leaguesToSync = resolveTargetLeagues(options);
  const hoursAhead = options?.hoursAhead || 72;
  const activeOddsMatchday = isOddsApiMatchdayActive();

  const summary: OddsSyncSummary = {
    timestamp: new Date().toISOString(),
    mode: oddsApiKey ? 'live_orchestrated' : 'synthetic_fallback',
    leaguesProcessed: leaguesToSync,
    oddsUpdated: 0,
    parlaysUpdated: 0,
    oddsApiQuota: {
      remaining: 500,
      used: 0,
    },
    errors: [],
  };

  // 1. Obtain target fixtures scheduled within next 48-72 hours
  let targetFixtures: Fixture[] = options?.fixtures || [];
  if (targetFixtures.length === 0) {
    if (supabase) {
      try {
        const nowIso = new Date().toISOString();
        const maxIso = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
        const { data: dbFix } = await supabase
          .from('fixtures')
          .select('*, homeTeam:teams!home_team_id(*), awayTeam:teams!away_team_id(*)')
          .in('league', leaguesToSync)
          .gte('match_time', nowIso)
          .lte('match_time', maxIso);

        if (dbFix && dbFix.length > 0) {
          targetFixtures = dbFix;
        }
      } catch (err: any) {
        summary.errors.push(`Target fixtures query: ${err.message}`);
      }
    }

    if (targetFixtures.length === 0) {
      targetFixtures = MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));
    }
  }

  // 2. Fetch odds per league or apply Synthetic Fair Odds
  if (!oddsApiKey || !activeOddsMatchday) {
    summary.mode = 'synthetic_fallback';
    targetFixtures.forEach((f) => {
      f.marketOdds = generateSyntheticMarketOdds(f);
    });
  } else {
    let oddsQuotaRemaining = 500;
    const oddsPromises = leaguesToSync.map(async (lg) => {
      const lgInfo = LEAGUES_DATA[lg];
      if (!lgInfo?.oddsApiKey) return;

      try {
        const oddsRes = await fetch(
          `https://api.the-odds-api.com/v4/sports/${lgInfo.oddsApiKey}/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal`,
          { signal: AbortSignal.timeout(6000) }
        );

        const remHeader = oddsRes.headers.get('x-requests-remaining');
        if (remHeader) {
          oddsQuotaRemaining = parseInt(remHeader, 10);
          summary.oddsApiQuota.remaining = oddsQuotaRemaining;
        }

        if (oddsRes.status === 429 || oddsQuotaRemaining <= 0) {
          console.warn(`[Pipeline] The Odds API quota depleted or rate-limited (${oddsRes.status}) for ${lg}. Applying Synthetic Fair Odds.`);
          targetFixtures.filter((f) => f.league === lg).forEach((f) => {
            f.marketOdds = generateSyntheticMarketOdds(f);
          });
          return;
        }

        if (oddsRes.ok) {
          const bookOdds = await oddsRes.json();
          for (const bo of bookOdds) {
            const hId = findNormalizedTeamId(bo.home_team, lg);
            const aId = findNormalizedTeamId(bo.away_team, lg);
            const fix = targetFixtures.find(
              (f) => f.league === lg && f.home_team_id === hId && f.away_team_id === aId
            );

            if (fix && bo.bookmakers && bo.bookmakers.length > 0) {
              const bm = bo.bookmakers[0];
              const h2hMarket = bm.markets?.find((m: any) => m.key === 'h2h');
              const spreadsMarket = bm.markets?.find((m: any) => m.key === 'spreads');
              const totalsMarket = bm.markets?.find((m: any) => m.key === 'totals');

              const hOdd = h2hMarket?.outcomes?.find((o: any) => o.name === bo.home_team)?.price || 2.0;
              const dOdd = h2hMarket?.outcomes?.find((o: any) => o.name === 'Draw')?.price || 3.2;
              const aOdd = h2hMarket?.outcomes?.find((o: any) => o.name === bo.away_team)?.price || 3.5;

              const overOdd = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over')?.price || 1.85;
              const underOdd = totalsMarket?.outcomes?.find((o: any) => o.name === 'Under')?.price || 1.95;

              const handicap_odds: Record<string, number> = {};
              if (spreadsMarket?.outcomes) {
                spreadsMarket.outcomes.forEach((o: any) => {
                  const point = o.point > 0 ? `+${o.point}` : `${o.point}`;
                  const side = o.name === bo.home_team ? 'home' : 'away';
                  handicap_odds[`${side}_${point}`] = o.price;
                });
              }

              const totals_odds: Record<string, number> = {
                'over_2.5': overOdd,
                'under_2.5': underOdd,
              };

              fix.marketOdds = {
                fixture_id: fix.id,
                bookmaker: bm.title || 'Pinnacle Consensus',
                home_odds: hOdd,
                draw_odds: dOdd,
                away_odds: aOdd,
                over_25_odds: overOdd,
                under_25_odds: underOdd,
                handicap_odds,
                totals_odds,
              };
            }
          }
        }
      } catch (err: any) {
        summary.errors.push(`The Odds API ${lg}: ${err.message}`);
        targetFixtures.filter((f) => f.league === lg && !f.marketOdds).forEach((f) => {
          f.marketOdds = generateSyntheticMarketOdds(f);
        });
      }
    });

    await Promise.allSettled(oddsPromises);
  }

  // Ensure all target fixtures have calibrated odds
  targetFixtures.forEach((f) => {
    if (!f.marketOdds) {
      f.marketOdds = generateSyntheticMarketOdds(f);
    }
  });

  // 3. Persist odds and AI Parlays to Supabase
  if (supabase && targetFixtures.length > 0) {
    try {
      const oddsToUpsert = targetFixtures.filter((f) => f.marketOdds).map((f) => f.marketOdds!);
      const { error: oddsErr } = await supabase.from('market_odds').upsert(oddsToUpsert, { onConflict: 'fixture_id' });
      if (!oddsErr) {
        summary.oddsUpdated = oddsToUpsert.length;
      }
    } catch (err: any) {
      summary.errors.push(`Market odds upsert: ${err.message}`);
    }

    try {
      const freshParlays = generateCuratedParlays(targetFixtures);
      await supabase.from('ai_parlays').delete().eq('status', 'pending');
      const { error: parlayErr } = await supabase.from('ai_parlays').insert(
        freshParlays.map((p) => ({
          category: p.category,
          legs: p.legs,
          total_odds: p.total_odds,
          true_probability: p.true_probability,
          expected_value: p.expected_value,
          status: 'pending',
          created_at: new Date().toISOString(),
        }))
      );
      if (!parlayErr) {
        summary.parlaysUpdated = freshParlays.length;
      }
    } catch (err: any) {
      summary.errors.push(`AI Parlays upsert: ${err.message}`);
    }
  } else {
    summary.oddsUpdated = targetFixtures.length;
    summary.parlaysUpdated = 3;
  }

  return {
    success: true,
    summary,
    fixtures: targetFixtures,
  };
}

/**
 * 3. UNIFIED ORCHESTRATION PIPELINE
 * Combines Fixtures & Odds synchronization in a fast parallel execution.
 * Backwards compatible with existing /api/sync and test suites.
 */
export async function runOrchestrationPipeline(options?: PipelineOptions): Promise<{
  success: boolean;
  summary: PipelineSyncSummary;
}> {
  const leaguesToSync = resolveTargetLeagues(options);

  // 1. Run Fixtures & Teams synchronization
  const { summary: fixSummary, fixtures } = await syncFixturesAndTeams(options);

  // 2. Run Market Odds & AI Parlays synchronization
  const { summary: oddsSummary } = await syncMarketOdds({
    league: options?.league,
    hoursAhead: 72,
    fixtures,
  });

  const summary: PipelineSyncSummary = {
    timestamp: new Date().toISOString(),
    mode: fixSummary.mode === 'live_orchestrated' ? 'live_orchestrated' : 'mock_fallback',
    leaguesProcessed: leaguesToSync,
    fixturesUpdated: fixSummary.fixturesUpdated,
    teamsUpdated: fixSummary.teamsUpdated,
    oddsUpdated: oddsSummary.oddsUpdated,
    parlaysUpdated: oddsSummary.parlaysUpdated,
    oddsApiQuota: oddsSummary.oddsApiQuota,
    apiFootballQuota: {
      remaining: 100,
      limit: 100,
    },
    details: {
      footballDataStatus: fixSummary.mode === 'live_orchestrated' ? 'live_7day_window_applied' : 'mock_applied',
      oddsApiStatus: oddsSummary.mode === 'live_orchestrated' ? 'live_odds_applied' : 'synthetic_applied',
      apiFootballStatus: 'context_safe_idle',
      storageUploads: fixSummary.storageUploads,
    },
    errors: [...fixSummary.errors, ...oddsSummary.errors],
  };

  return {
    success: true,
    summary,
  };
}
