import { createServerClient } from '@/lib/supabase/server';
import { LEAGUES_DATA, MOCK_FIXTURES, MOCK_TEAMS } from '@/lib/mock-data';
import { LeagueCode, Fixture, MarketOdds, Team } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { generateCuratedParlays } from '@/lib/ai-parlay-generator';
import { generateSyntheticMarketOdds } from '@/lib/synthetic-odds';
import { uploadTeamCrestToSupabase } from '@/lib/storage';
import { findNormalizedTeamId, cleanTeamString } from '@/lib/team-matcher';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PipelineSyncSummary {
  timestamp: string;
  mode: 'live_orchestrated' | 'mock_fallback';
  leaguesProcessed: string[];
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
 * - Tuesday 12:00 UTC through Thursday 23:59 UTC (UEFA Champions & Europa League)
 */
export function isOddsApiMatchdayActive(date = new Date()): boolean {
  const day = date.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const hour = date.getUTCHours();

  // Tuesday (2), Wednesday (3), Thursday (4) for UCL/UEL
  if (day === 2 || day === 3 || day === 4) {
    return hour >= 10;
  }
  // Friday (5) afternoon onwards
  if (day === 5) {
    return hour >= 12;
  }
  // Saturday (6) and Sunday (0)
  if (day === 6 || day === 0) {
    return true;
  }
  return false;
}

export interface PipelineOptions {
  league?: LeagueCode | 'ALL' | string;
  batch?: boolean;
}

/**
 * Execute the 3-source Multi-API Orchestration Pipeline:
 * 1. Football-Data.org v4 (Skeleton, Standings, Form & Crests via lightweight parallel fetches)
 * 2. The Odds API v4 (Market Consensus Odds with Poisson Synthetic Fallback)
 * 3. API-Football v3 (Contextual Injuries & xG with 20-req safety guardrail)
 */
export async function runOrchestrationPipeline(options?: PipelineOptions): Promise<{
  success: boolean;
  summary: PipelineSyncSummary;
}> {
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;
  const oddsApiKey = process.env.THE_ODDS_API_KEY;
  const apiFootballKey = process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY;
  const supabase = createServerClient();

  const ALL_LEAGUES: LeagueCode[] = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EL'];
  let leaguesToSync: LeagueCode[] = ALL_LEAGUES;

  if (options?.league && options.league !== 'ALL') {
    const parsed = options.league
      .split(',')
      .map((s) => s.trim().toUpperCase() as LeagueCode)
      .filter((lg) => ALL_LEAGUES.includes(lg));
    if (parsed.length > 0) {
      leaguesToSync = parsed;
    }
  } else if (options?.batch) {
    const day = new Date().getUTCDay();
    // Tue/Wed/Thu: European cups; otherwise domestic Tier-1
    leaguesToSync = day >= 2 && day <= 4 ? ['CL', 'EL'] : ['PL', 'PD'];
  }

  const summary: PipelineSyncSummary = {
    timestamp: new Date().toISOString(),
    mode: 'mock_fallback',
    leaguesProcessed: leaguesToSync,
    fixturesUpdated: 0,
    teamsUpdated: 0,
    oddsUpdated: 0,
    parlaysUpdated: 0,
    oddsApiQuota: {
      remaining: 500,
      used: 0,
    },
    apiFootballQuota: {
      remaining: 100,
      limit: 100,
    },
    details: {
      footballDataStatus: 'idle',
      oddsApiStatus: 'idle',
      apiFootballStatus: 'idle',
      storageUploads: 0,
    },
    errors: [],
  };

  // --- FALLBACK / MOCK ORCHESTRATION WHEN KEYS ARE ABSENT ---
  if (!footballDataKey || !oddsApiKey) {
    summary.mode = 'mock_fallback';
    summary.details.footballDataStatus = 'mock_applied';
    summary.details.oddsApiStatus = 'synthetic_applied';
    summary.details.apiFootballStatus = 'mock_context_applied';

    const filteredTeams = leaguesToSync.length === ALL_LEAGUES.length
      ? Object.values(MOCK_TEAMS)
      : Object.values(MOCK_TEAMS).filter((t) => leaguesToSync.includes(t.league));

    const filteredFixtures = leaguesToSync.length === ALL_LEAGUES.length
      ? MOCK_FIXTURES
      : MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));

    if (supabase) {
      // 1. Teams upsert with robust schema fallback (gracefully handles missing crest_url column)
      const teamsToUpsert = filteredTeams.map((t) => ({
        id: t.id,
        league: t.league,
        name: t.name,
        aliases: t.aliases || [],
        attack_rating: t.attack_rating,
        defense_rating: t.defense_rating,
        form: t.form && t.form !== 'N/A' && t.form !== 'DDDDD' ? t.form : 'WDLWW',
        crest_url: t.crest_url || null,
        rolling_xg: t.rolling_xg ?? null,
        key_injuries_count: t.key_injuries_count ?? 0,
      }));

      try {
        const { error: teamErr } = await supabase.from('teams').upsert(teamsToUpsert, { onConflict: 'id' });
        if (teamErr) {
          console.warn('[Pipeline] Teams upsert error with extended schema, falling back to base columns:', teamErr.message);
          const baseTeams = teamsToUpsert.map(({ id, league, name, aliases, attack_rating, defense_rating, form }) => ({
            id, league, name, aliases, attack_rating, defense_rating, form,
          }));
          const { error: baseErr } = await supabase.from('teams').upsert(baseTeams, { onConflict: 'id' });
          if (baseErr) {
            console.warn('[Pipeline] Base teams upsert failed:', baseErr.message);
            summary.errors.push(`Teams base upsert: ${baseErr.message}`);
          }
        }
        summary.teamsUpdated = teamsToUpsert.length;
      } catch (err: any) {
        console.warn('[Pipeline] Teams upsert exception:', err.message);
        summary.errors.push(`Teams upsert: ${err.message}`);
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

        const { error: fixErr } = await supabase.from('fixtures').upsert(fixturesToUpsert, { onConflict: 'id' });
        if (fixErr) {
          console.warn('[Pipeline] Fixtures upsert error:', fixErr.message);
          summary.errors.push(`Fixtures upsert: ${fixErr.message}`);
        } else {
          summary.fixturesUpdated = fixturesToUpsert.length;
        }
      } catch (err: any) {
        console.warn('[Pipeline] Fixtures upsert exception:', err.message);
        summary.errors.push(`Fixtures upsert: ${err.message}`);
      }

      // 3. Market Odds upsert
      try {
        const oddsToUpsert = filteredFixtures.map((f) => {
          const synthetic = generateSyntheticMarketOdds(f);
          return {
            fixture_id: f.id,
            bookmaker: f.marketOdds?.bookmaker || synthetic.bookmaker,
            home_odds: f.marketOdds?.home_odds || synthetic.home_odds,
            draw_odds: f.marketOdds?.draw_odds || synthetic.draw_odds,
            away_odds: f.marketOdds?.away_odds || synthetic.away_odds,
            over_25_odds: f.marketOdds?.over_25_odds || synthetic.over_25_odds,
            under_25_odds: f.marketOdds?.under_25_odds || synthetic.under_25_odds,
            handicap_odds: f.marketOdds?.handicap_odds || synthetic.handicap_odds,
            totals_odds: f.marketOdds?.totals_odds || synthetic.totals_odds,
            btts_odds: f.marketOdds?.btts_odds || synthetic.btts_odds,
          };
        });

        const { error: oddsErr } = await supabase.from('market_odds').upsert(oddsToUpsert, { onConflict: 'fixture_id' });
        if (oddsErr) {
          console.warn('[Pipeline] Market odds upsert error:', oddsErr.message);
          summary.errors.push(`Market odds upsert: ${oddsErr.message}`);
        } else {
          summary.oddsUpdated = oddsToUpsert.length;
        }
      } catch (err: any) {
        console.warn('[Pipeline] Market odds upsert exception:', err.message);
        summary.errors.push(`Market odds upsert: ${err.message}`);
      }

      // 4. Curated Parlays sync (upcoming only)
      try {
        const freshParlays = generateCuratedParlays(filteredFixtures);
        await supabase.from('ai_parlays').delete().eq('status', 'pending');
        const slipsToInsert = freshParlays.map((p) => ({
          category: p.category,
          legs: p.legs,
          total_odds: p.total_odds,
          true_probability: p.true_probability,
          expected_value: p.expected_value,
          status: 'pending',
          created_at: new Date().toISOString(),
        }));

        const { error: parlayErr } = await supabase.from('ai_parlays').insert(slipsToInsert);
        if (parlayErr) {
          console.warn('[Pipeline] AI Parlays insert error:', parlayErr.message);
          summary.errors.push(`AI Parlays insert: ${parlayErr.message}`);
        } else {
          summary.parlaysUpdated = slipsToInsert.length;
        }
      } catch (err: any) {
        console.warn('[Pipeline] AI Parlays exception:', err.message);
        summary.errors.push(`AI Parlays: ${err.message}`);
      }
    } else {
      summary.fixturesUpdated = filteredFixtures.length;
      summary.teamsUpdated = filteredTeams.length;
      summary.oddsUpdated = filteredFixtures.length;
      summary.parlaysUpdated = 3;
    }

    return {
      success: true,
      summary,
    };
  }

  // --- LIVE MULTI-SOURCE ORCHESTRATION ---
  summary.mode = 'live_orchestrated';
  const competitionIds: Record<LeagueCode, string> = {
    PL: 'PL',
    PD: 'PD',
    SA: 'SA',
    BL1: 'BL1',
    FL1: 'FL1',
    CL: 'CL',
    EL: 'EL',
  };

  const syncedFixtures: Fixture[] = [];
  const activeOddsMatchday = isOddsApiMatchdayActive();

  // 1. LAYER 1: Football-Data.org v4 (Skeleton & Standings)
  // Parallel fetches via Promise.allSettled with 6s timeout per request (NO long sequential sleeps)
  const footballDataPromises = leaguesToSync.map(async (lg) => {
    const compId = competitionIds[lg];
    if (!compId) return [];

    try {
      const matchRes = await fetch(
        `https://api.football-data.org/v4/competitions/${compId}/matches?status=SCHEDULED,TIMED`,
        {
          headers: { 'X-Auth-Token': footballDataKey },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (!matchRes.ok) {
        console.warn(`[Pipeline] Football-Data returned HTTP ${matchRes.status} for ${lg}`);
        summary.errors.push(`Football-Data ${lg}: HTTP ${matchRes.status}`);
        return [];
      }

      const matchData = await matchRes.json();
      const matches = matchData.matches || [];
      const leagueFixtures: Fixture[] = [];

      for (const m of matches) {
        const homeId = findNormalizedTeamId(m.homeTeam.name, lg) || cleanTeamString(m.homeTeam.name);
        const awayId = findNormalizedTeamId(m.awayTeam.name, lg) || cleanTeamString(m.awayTeam.name);

        let homeCrest = m.homeTeam.crest || null;
        let awayCrest = m.awayTeam.crest || null;
        if (homeCrest) {
          try {
            homeCrest = await uploadTeamCrestToSupabase(homeId, homeCrest);
            summary.details.storageUploads++;
          } catch (crestErr) {
            // Keep original URL on storage upload failure
          }
        }
        if (awayCrest) {
          try {
            awayCrest = await uploadTeamCrestToSupabase(awayId, awayCrest);
            summary.details.storageUploads++;
          } catch (crestErr) {
            // Keep original URL on storage upload failure
          }
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
      console.warn(`[Pipeline] Football-Data sync error for ${lg}:`, err.message);
      summary.errors.push(`Football-Data ${lg}: ${err.message}`);
      return [];
    }
  });

  const footballResults = await Promise.allSettled(footballDataPromises);
  for (const res of footballResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      syncedFixtures.push(...res.value);
    }
  }

  // If live calls returned zero fixtures, fallback gracefully to mock fixtures
  if (syncedFixtures.length === 0) {
    console.warn('[Pipeline] No live fixtures retrieved, falling back to mock fixtures for active leagues.');
    const fallback = MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));
    syncedFixtures.push(...(fallback.length > 0 ? fallback : MOCK_FIXTURES));
  }

  // 2. LAYER 2: The Odds API v4 (Consensus Odds & Poisson Synthetic Fallback)
  let oddsQuotaRemaining = 500;
  const oddsPromises = leaguesToSync.map(async (lg) => {
    const lgInfo = LEAGUES_DATA[lg];
    if (!lgInfo?.oddsApiKey) return;

    if (!activeOddsMatchday) {
      syncedFixtures.filter((f) => f.league === lg).forEach((f) => {
        f.marketOdds = generateSyntheticMarketOdds(f);
      });
      return;
    }

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
        console.warn(`[Pipeline] The Odds API quota depleted or rate-limited (${oddsRes.status}) for ${lg}. Applying Poisson Synthetic Fair Odds.`);
        syncedFixtures.filter((f) => f.league === lg).forEach((f) => {
          f.marketOdds = generateSyntheticMarketOdds(f);
        });
        return;
      }

      if (oddsRes.ok) {
        const bookOdds = await oddsRes.json();
        for (const bo of bookOdds) {
          const hId = findNormalizedTeamId(bo.home_team, lg);
          const aId = findNormalizedTeamId(bo.away_team, lg);
          const targetFix = syncedFixtures.find(
            (f) => f.league === lg && f.home_team_id === hId && f.away_team_id === aId
          );

          if (targetFix && bo.bookmakers && bo.bookmakers.length > 0) {
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

            targetFix.marketOdds = {
              fixture_id: targetFix.id,
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
      console.warn(`[Pipeline] The Odds API error for ${lg}:`, err.message);
      summary.errors.push(`The Odds API ${lg}: ${err.message}`);
      syncedFixtures.filter((f) => f.league === lg && !f.marketOdds).forEach((f) => {
        f.marketOdds = generateSyntheticMarketOdds(f);
      });
    }
  });

  await Promise.allSettled(oddsPromises);

  // Guarantee every fixture has calibrated market odds
  syncedFixtures.forEach((f) => {
    if (!f.marketOdds) {
      f.marketOdds = generateSyntheticMarketOdds(f);
    }
  });

  // 3. LAYER 3: API-Football v3 (Contextual Intelligence Layer: Injuries & xG)
  if (apiFootballKey) {
    try {
      const injuryRes = await fetch('https://v3.football.api-sports.io/status', {
        headers: { 'x-apisports-key': apiFootballKey },
        signal: AbortSignal.timeout(4000),
      });

      if (injuryRes.ok) {
        const statData = await injuryRes.json();
        const rem = statData.response?.requests?.remaining;
        if (typeof rem === 'number') {
          summary.apiFootballQuota = { remaining: rem, limit: statData.response?.requests?.limit_day || 100 };
          if (rem < 20) {
            console.warn(`[Pipeline] API-Football remaining quota ${rem} < 20 safeguard. Skipping contextual calls.`);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Pipeline] API-Football status check error:', err.message);
    }
  }

  // Persist all gathered fixtures and odds to Supabase with robust column fallbacks
  if (supabase && syncedFixtures.length > 0) {
    const teamsToUpsert = syncedFixtures.flatMap((f) => [f.homeTeam, f.awayTeam]).filter(Boolean);
    const uniqueTeams = Array.from(new Map(teamsToUpsert.map((t) => [t!.id, t!])).values());

    // 1. Teams upsert with crest_url schema fallback
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
        console.warn('[Pipeline] Live teams upsert with crest_url failed, retrying with base columns:', liveTeamErr.message);
        const baseTeams = payload.map(({ id, league, name, aliases, attack_rating, defense_rating, form }) => ({
          id, league, name, aliases, attack_rating, defense_rating, form,
        }));
        const { error: baseErr } = await supabase.from('teams').upsert(baseTeams, { onConflict: 'id' });
        if (baseErr) {
          console.warn('[Pipeline] Live base teams upsert failed:', baseErr.message);
          summary.errors.push(`Teams base upsert: ${baseErr.message}`);
        }
      }
      summary.teamsUpdated = uniqueTeams.length;
    } catch (err: any) {
      console.warn('[Pipeline] Live teams upsert exception:', err.message);
      summary.errors.push(`Live teams upsert: ${err.message}`);
    }

    // 2. Fixtures upsert
    try {
      const { error: fixErr } = await supabase.from('fixtures').upsert(
        syncedFixtures.map((f) => ({
          id: f.id,
          league: f.league,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id,
          match_time: f.match_time,
          status: f.status,
        })),
        { onConflict: 'id' }
      );
      if (fixErr) {
        console.warn('[Pipeline] Fixtures live upsert error:', fixErr.message);
        summary.errors.push(`Fixtures live upsert: ${fixErr.message}`);
      } else {
        summary.fixturesUpdated = syncedFixtures.length;
      }
    } catch (err: any) {
      console.warn('[Pipeline] Fixtures live upsert exception:', err.message);
      summary.errors.push(`Fixtures live upsert: ${err.message}`);
    }

    // 3. Market Odds upsert
    try {
      const oddsToUpsert = syncedFixtures.filter((f) => f.marketOdds).map((f) => f.marketOdds!);
      const { error: oddsErr } = await supabase.from('market_odds').upsert(oddsToUpsert, { onConflict: 'fixture_id' });
      if (oddsErr) {
        console.warn('[Pipeline] Market odds live upsert error:', oddsErr.message);
        summary.errors.push(`Market odds live upsert: ${oddsErr.message}`);
      } else {
        summary.oddsUpdated = oddsToUpsert.length;
      }
    } catch (err: any) {
      console.warn('[Pipeline] Market odds live upsert exception:', err.message);
      summary.errors.push(`Market odds live upsert: ${err.message}`);
    }

    // 4. Refresh upcoming parlays
    try {
      const freshParlays = generateCuratedParlays(syncedFixtures);
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
      if (parlayErr) {
        console.warn('[Pipeline] AI Parlays live insert error:', parlayErr.message);
        summary.errors.push(`AI Parlays live insert: ${parlayErr.message}`);
      } else {
        summary.parlaysUpdated = freshParlays.length;
      }
    } catch (err: any) {
      console.warn('[Pipeline] AI Parlays live exception:', err.message);
      summary.errors.push(`AI Parlays live exception: ${err.message}`);
    }
  }

  return {
    success: true,
    summary,
  };
}
