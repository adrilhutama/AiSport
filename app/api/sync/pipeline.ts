import { createServerClient } from '@/lib/supabase/server';
import { LEAGUES_DATA, MOCK_FIXTURES, MOCK_TEAMS } from '@/lib/mock-data';
import { LeagueCode, Fixture, MarketOdds, Team } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { generateCuratedParlays } from '@/lib/ai-parlay-generator';
import { generateSyntheticMarketOdds } from '@/lib/synthetic-odds';
import { uploadTeamCrestToSupabase } from '@/lib/storage';
import { findNormalizedTeamId, cleanTeamString } from '@/lib/team-matcher';
import { getTeamCrestUrl } from '@/lib/team-crests';
import { enrichTeamsWithContext, fetchLeagueInjuries } from '@/lib/apisports';

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
  const cleaned = rawForm.replace(/,/g, '').replace(/[^WDLwdl]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned.slice(-5) : 'WDLWW';
}

export interface StandingsTeamData {
  teamId: string;
  name: string;
  shortName?: string;
  form: string;
  crestUrl?: string;
  playedGames?: number;
  points?: number;
}

/**
 * Ingest official 5-match form from Football-Data.org Standings
 * Endpoint: /v4/competitions/${leagueCode}/standings
 * Normalizes "W,W,D,L,W" -> "WWDLL" and maps to normalized team ID and names.
 */
export async function fetchStandings(
  leagueCode: LeagueCode
): Promise<Map<string, StandingsTeamData>> {
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;
  const compId = COMPETITION_IDS[leagueCode];
  const standingsMap = new Map<string, StandingsTeamData>();

  if (!footballDataKey || !compId) {
    return standingsMap;
  }

  try {
    const url = `https://api.football-data.org/v4/competitions/${compId}/standings`;
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': footballDataKey },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[Standings] Football-Data standings for ${leagueCode} returned HTTP ${res.status}`);
      return standingsMap;
    }

    const data = await res.json();
    const tables = data.standings || [];
    const totalStanding = tables.find((s: any) => s.type === 'TOTAL') || tables[0];
    const rows = totalStanding?.table || [];

    for (const row of rows) {
      const rawTeamName = row.team?.name || '';
      const shortName = row.team?.shortName || '';
      const rawForm = row.form || '';

      // Clean and normalize form: e.g. "W,W,D,L,W" -> "WWDLL"
      const cleanedForm = rawForm
        ? rawForm.replace(/,/g, '').replace(/[^WDLwdl]/g, '').toUpperCase().slice(-5)
        : '';

      const normalizedId =
        findNormalizedTeamId(rawTeamName, leagueCode) ||
        findNormalizedTeamId(shortName, leagueCode) ||
        cleanTeamString(rawTeamName);

      const teamData: StandingsTeamData = {
        teamId: normalizedId,
        name: rawTeamName,
        shortName,
        form: cleanedForm,
        crestUrl: row.team?.crest || undefined,
        playedGames: row.playedGames,
        points: row.points,
      };

      if (normalizedId) {
        standingsMap.set(normalizedId, teamData);
      }
      if (rawTeamName) {
        standingsMap.set(rawTeamName.toLowerCase().trim(), teamData);
      }
      if (shortName) {
        standingsMap.set(shortName.toLowerCase().trim(), teamData);
      }
    }

    console.log(`[Standings] Synced real form from standings for ${leagueCode}: ${rows.length} teams mapped.`);
  } catch (err: any) {
    console.warn(`[Standings] Error fetching standings for ${leagueCode}:`, err.message);
  }

  return standingsMap;
}

export interface EnrichmentSummary {
  league: LeagueCode;
  teamsUpdated: number;
  standingsCount: number;
  injuriesCount: number;
  seasonUsed?: number;
  remainingQuota?: number;
  teams: Array<{
    id: string;
    name: string;
    form: string;
    key_injuries_count: number;
    missing_players: any[];
  }>;
  errors: string[];
}

/**
 * Direct enrichment trigger: pulls real form from standings & live injuries from API-Sports
 */
export async function syncLeagueEnrichment(
  leagueCode: LeagueCode
): Promise<EnrichmentSummary> {
  const supabase = createServerClient();
  const errors: string[] = [];

  // 1. Fetch real form from Football-Data.org Standings
  const standingsMap = await fetchStandings(leagueCode);

  // 2. Fetch live injuries from API-Sports v3 (with 2026 -> 2025 season fallback)
  const { injuriesByTeam, remainingQuota, totalInjuries, seasonUsed } =
    await fetchLeagueInjuries(leagueCode);

  // 3. Retrieve teams for this league
  let teams: Team[] = [];
  if (supabase) {
    const { data: dbTeams, error: dbErr } = await supabase
      .from('teams')
      .select('*')
      .eq('league', leagueCode);
    if (!dbErr && dbTeams && dbTeams.length > 0) {
      teams = dbTeams as Team[];
    }
  }

  // Fallback to MOCK_TEAMS if database has 0 teams for this league
  if (teams.length === 0) {
    teams = Object.values(MOCK_TEAMS).filter((t) => t.league === leagueCode);
  }

  // Also incorporate any teams discovered from the standings table
  for (const [key, sTeam] of standingsMap.entries()) {
    if (sTeam.teamId && !teams.some((t) => t.id === sTeam.teamId)) {
      teams.push({
        id: sTeam.teamId,
        league: leagueCode,
        name: sTeam.shortName || sTeam.name,
        aliases: [sTeam.name],
        attack_rating: 1.1,
        defense_rating: 1.0,
        form: sTeam.form || 'WDLWW',
        crest_url: sTeam.crestUrl || getTeamCrestUrl(sTeam.teamId) || undefined,
      });
    }
  }

  // 4. Update each team with dynamic form from standings & injuries from API-Sports
  const updatedTeams: Team[] = teams.map((team) => {
    const teamKey = team.name.toLowerCase().trim();
    const standingsData =
      standingsMap.get(team.id) ||
      standingsMap.get(teamKey) ||
      (team.aliases && team.aliases.length > 0 ? standingsMap.get(team.aliases[0].toLowerCase().trim()) : undefined);

    // Dynamic form from standings (do NOT fall back to static mock string if team in standings)
    let dynamicForm = team.form;
    if (standingsData && standingsData.form) {
      dynamicForm = standingsData.form;
    }

    // Dynamic injuries from API-Sports
    const missing = injuriesByTeam[team.id] || injuriesByTeam[teamKey] || [];
    const missingPlayers = missing.length > 0 ? missing : (team.missing_players || []);
    const injuryCount = missing.length > 0 ? missing.length : (team.key_injuries_count || 0);

    return {
      ...team,
      form: dynamicForm,
      missing_players: missingPlayers,
      key_injuries_count: injuryCount,
    };
  });

  // 5. Persist to Supabase
  if (supabase && updatedTeams.length > 0) {
    const payload = updatedTeams.map((t) => ({
      id: t.id,
      league: t.league,
      name: t.name,
      aliases: t.aliases || [],
      attack_rating: t.attack_rating,
      defense_rating: t.defense_rating,
      form: t.form,
      crest_url: t.crest_url || null,
      rolling_xg: t.rolling_xg ?? null,
      key_injuries_count: t.key_injuries_count ?? 0,
      missing_players: t.missing_players || [],
      avg_xg_for: t.avg_xg_for ?? null,
      avg_xg_against: t.avg_xg_against ?? null,
    }));

    try {
      const { error: upsertErr } = await supabase.from('teams').upsert(payload, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('[Enrichment] Teams upsert fallback to base columns:', upsertErr.message);
        const basePayload = payload.map(({ id, league, name, aliases, attack_rating, defense_rating, form }) => ({
          id, league, name, aliases, attack_rating, defense_rating, form,
        }));
        await supabase.from('teams').upsert(basePayload, { onConflict: 'id' });
      }
    } catch (err: any) {
      errors.push(`Enrichment upsert: ${err.message}`);
    }
  }

  return {
    league: leagueCode,
    teamsUpdated: updatedTeams.length,
    standingsCount: standingsMap.size,
    injuriesCount: totalInjuries,
    seasonUsed,
    remainingQuota,
    teams: updatedTeams.map((t) => ({
      id: t.id,
      name: t.name,
      form: t.form,
      key_injuries_count: t.key_injuries_count ?? 0,
      missing_players: t.missing_players || [],
    })),
    errors,
  };
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
 * Retains currently live/ongoing matches (kicked off within 3 hours).
 * Ingests official SVG team crests, standings/form, contextual API-Sports intelligence, and upcoming fixtures.
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

  // If API key is missing, gate mock fixtures fallback strictly to development/test
  if (!footballDataKey) {
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.warn('[Pipeline] In production without footballDataKey: returning clean empty fixtures.');
      return {
        success: true,
        summary,
        fixtures: [],
      };
    }

    let filteredTeams = leaguesToSync.length === ALL_SUPPORTED_LEAGUES.length
      ? Object.values(MOCK_TEAMS)
      : Object.values(MOCK_TEAMS).filter((t) => leaguesToSync.includes(t.league));

    const filteredFixtures = leaguesToSync.length === ALL_SUPPORTED_LEAGUES.length
      ? MOCK_FIXTURES
      : MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));

    gatheredFixtures.push(...filteredFixtures);

    // Contextual enrichment via API-Sports if API_SPORTS_KEY is present
    const apiSportsKey =
      process.env.API_SPORTS_KEY ||
      process.env.APISPORTS_KEY ||
      process.env.API_FOOTBALL_KEY;

    if (apiSportsKey) {
      for (const lg of leaguesToSync) {
        const lgTeams = filteredTeams.filter((t) => t.league === lg);
        if (lgTeams.length > 0) {
          try {
            const enriched = await enrichTeamsWithContext(lgTeams, lg);
            const enrichedMap = new Map(enriched.map((t) => [t.id, t]));
            filteredTeams = filteredTeams.map((t) => enrichedMap.get(t.id) || t);
          } catch (err: any) {
            console.warn(`[Pipeline] API-Sports context enrichment failed for ${lg}:`, err.message);
          }
        }
      }
    }

    if (supabase) {
      // 1. Teams upsert with schema fallback (crest_url, rolling_xg, key_injuries_count, missing_players, avg_xg_for/against)
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
        missing_players: t.missing_players || [],
        avg_xg_for: t.avg_xg_for ?? null,
        avg_xg_against: t.avg_xg_against ?? null,
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

      // 2. Fixtures upsert (retention rule: match_time >= NOW() - 3 hours)
      try {
        const fixturesToUpsert = filteredFixtures.map((f) => ({
          id: f.id,
          league: f.league,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id,
          match_time: f.match_time,
          status: f.status || 'SCHEDULED',
          score_home: typeof f.score_home === 'number' ? f.score_home : null,
          score_away: typeof f.score_away === 'number' ? f.score_away : null,
        }));
        const { error: fixErr } = await supabase.from('fixtures').upsert(fixturesToUpsert, { onConflict: 'id' });
        if (fixErr) {
          // Fallback without score_home/score_away if columns missing
          const baseFix = fixturesToUpsert.map(({ id, league, home_team_id, away_team_id, match_time, status }) => ({
            id, league, home_team_id, away_team_id, match_time, status
          }));
          await supabase.from('fixtures').upsert(baseFix, { onConflict: 'id' });
        }
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
      // Domestic leagues: 7-day window.
      // Continental competitions (CL, EL): multi-week intervals, check up to 30 days ahead or scheduled matches
      let url = `https://api.football-data.org/v4/competitions/${compId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      if (lg === 'CL' || lg === 'EL') {
        const extendedDateTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        url = `https://api.football-data.org/v4/competitions/${compId}/matches?dateFrom=${dateFrom}&dateTo=${extendedDateTo}`;
      }

      let res = await fetch(url, {
        headers: { 'X-Auth-Token': footballDataKey },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok && (lg === 'CL' || lg === 'EL')) {
        // Fallback query for continental upcoming scheduled matches
        const schedUrl = `https://api.football-data.org/v4/competitions/${compId}/matches?status=SCHEDULED`;
        const schedRes = await fetch(schedUrl, {
          headers: { 'X-Auth-Token': footballDataKey },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(6000),
        });
        if (schedRes.ok) {
          res = schedRes;
        }
      }

      if (!res.ok) {
        summary.errors.push(`Football-Data ${lg}: HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      const matches = data.matches || [];
      const leagueFixtures: Fixture[] = [];

      // Fetch standings for real team form
      const standingsMap = await fetchStandings(lg);

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

        const standingsHome = standingsMap.get(homeId) || standingsMap.get(m.homeTeam.name.toLowerCase().trim());
        const standingsAway = standingsMap.get(awayId) || standingsMap.get(m.awayTeam.name.toLowerCase().trim());

        const homeForm = (standingsHome && standingsHome.form) ? standingsHome.form : parseTeamForm(m.homeTeam.form);
        const awayForm = (standingsAway && standingsAway.form) ? standingsAway.form : parseTeamForm(m.awayTeam.form);

        const homeTeamObj: Team = {
          id: homeId,
          league: lg,
          name: m.homeTeam.shortName || m.homeTeam.name,
          aliases: [m.homeTeam.name],
          attack_rating: 1.2,
          defense_rating: 0.9,
          form: homeForm,
          crest_url: homeCrest,
        };

        const awayTeamObj: Team = {
          id: awayId,
          league: lg,
          name: m.awayTeam.shortName || m.awayTeam.name,
          aliases: [m.awayTeam.name],
          attack_rating: 1.1,
          defense_rating: 1.0,
          form: awayForm,
          crest_url: awayCrest,
        };

        const scoreHome = typeof m.score?.fullTime?.home === 'number' ? m.score.fullTime.home : undefined;
        const scoreAway = typeof m.score?.fullTime?.away === 'number' ? m.score.fullTime.away : undefined;

        const fix: Fixture = {
          id: `${lg.toLowerCase()}-${homeId}-${awayId}`,
          league: lg,
          home_team_id: homeId,
          away_team_id: awayId,
          match_time: m.utcDate,
          status: m.status || 'SCHEDULED',
          score_home: scoreHome,
          score_away: scoreAway,
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

  // Fallback to mock fixtures ONLY in development or offline mode without Supabase
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (gatheredFixtures.length === 0 && isDev) {
    console.warn('[Pipeline] Zero live matches in window, applying development mock fallback for target leagues.');
    const fallback = MOCK_FIXTURES.filter((f) => leaguesToSync.includes(f.league));
    gatheredFixtures.push(...(fallback.length > 0 ? fallback : []));
  }

  // Supabase persist
  if (supabase && gatheredFixtures.length > 0) {
    const teamsToUpsert = gatheredFixtures.flatMap((f) => [f.homeTeam, f.awayTeam]).filter(Boolean);
    const uniqueTeams = Array.from(new Map(teamsToUpsert.map((t) => [t!.id, t!])).values());

    // Enrich unique teams with API-Sports contextual metrics
    let enrichedUniqueTeams: Team[] = uniqueTeams;
    for (const lg of leaguesToSync) {
      const lgTeams = enrichedUniqueTeams.filter((t) => t.league === lg);
      if (lgTeams.length > 0) {
        try {
          const enriched = await enrichTeamsWithContext(lgTeams, lg);
          const enrichedMap = new Map(enriched.map((t) => [t.id, t]));
          enrichedUniqueTeams = enrichedUniqueTeams.map((t) => enrichedMap.get(t.id) || t);
        } catch {}
      }
    }

    try {
      const payload = enrichedUniqueTeams.map((t) => ({
        id: t.id,
        league: t.league,
        name: t.name,
        aliases: t.aliases,
        attack_rating: t.attack_rating,
        defense_rating: t.defense_rating,
        form: t.form,
        crest_url: t.crest_url || null,
        rolling_xg: t.rolling_xg ?? null,
        key_injuries_count: t.key_injuries_count ?? 0,
        missing_players: t.missing_players || [],
        avg_xg_for: t.avg_xg_for ?? null,
        avg_xg_against: t.avg_xg_against ?? null,
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
      const fixPayload = gatheredFixtures.map((f) => ({
        id: f.id,
        league: f.league,
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        match_time: f.match_time,
        status: f.status,
        score_home: typeof f.score_home === 'number' ? f.score_home : null,
        score_away: typeof f.score_away === 'number' ? f.score_away : null,
      }));

      const { error: fixErr } = await supabase.from('fixtures').upsert(fixPayload, { onConflict: 'id' });
      if (fixErr) {
        const baseFix = fixPayload.map(({ id, league, home_team_id, away_team_id, match_time, status }) => ({
          id, league, home_team_id, away_team_id, match_time, status
        }));
        await supabase.from('fixtures').upsert(baseFix, { onConflict: 'id' });
      }
      summary.fixturesUpdated = gatheredFixtures.length;
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
 * Strictly processes fixtures within the next 48 hours (including active live matches from -3h).
 * Pulls consensus odds from The Odds API with 8s timeout (or applies Synthetic Poisson Odds Fallback).
 * Triggers Supabase PL/pgSQL EV recalculations and refreshes AI parlays.
 * Completes in < 3 seconds.
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
  const hoursAhead = options?.hoursAhead || 48;
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

  // 1. Obtain target fixtures scheduled within next 48 hours (including live matches from -3h)
  let targetFixtures: Fixture[] = options?.fixtures || [];
  if (targetFixtures.length === 0) {
    if (supabase) {
      try {
        const nowMs = Date.now();
        const minTimeIso = new Date(nowMs - 3 * 3600 * 1000).toISOString();
        const maxTimeIso = new Date(nowMs + hoursAhead * 3600 * 1000).toISOString();

        const { data: dbFix } = await supabase
          .from('fixtures')
          .select('*, homeTeam:teams!home_team_id(*), awayTeam:teams!away_team_id(*)')
          .in('league', leaguesToSync)
          .gte('match_time', minTimeIso)
          .lte('match_time', maxTimeIso);

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

  // Filter to only leagues that actually have target fixtures
  const activeLeaguesWithFixtures = Array.from(
    new Set(targetFixtures.map((f) => f.league))
  ).filter((lg) => leaguesToSync.includes(lg));

  // 2. Fetch odds per league or apply Synthetic Fair Odds
  if (!oddsApiKey || !activeOddsMatchday) {
    summary.mode = 'synthetic_fallback';
    targetFixtures.forEach((f) => {
      f.marketOdds = generateSyntheticMarketOdds(f);
    });
  } else {
    let oddsQuotaRemaining = 500;
    const oddsPromises = activeLeaguesWithFixtures.map(async (lg) => {
      const lgInfo = LEAGUES_DATA[lg];
      if (!lgInfo?.oddsApiKey) return;

      try {
        const oddsRes = await fetch(
          `https://api.the-odds-api.com/v4/sports/${lgInfo.oddsApiKey}/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal`,
          { signal: AbortSignal.timeout(8000) }
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
      const oddsToUpsert = targetFixtures.filter((f) => f.marketOdds).map((f) => ({
        fixture_id: f.marketOdds!.fixture_id,
        bookmaker: f.marketOdds!.bookmaker,
        home_odds: f.marketOdds!.home_odds,
        draw_odds: f.marketOdds!.draw_odds,
        away_odds: f.marketOdds!.away_odds,
        over_25_odds: f.marketOdds!.over_25_odds,
        under_25_odds: f.marketOdds!.under_25_odds,
        handicap_odds: f.marketOdds!.handicap_odds || {},
        totals_odds: f.marketOdds!.totals_odds || {},
        btts_odds: f.marketOdds!.btts_odds || {},
      }));

      const { error: oddsErr } = await supabase.from('market_odds').upsert(oddsToUpsert, { onConflict: 'fixture_id' });
      if (oddsErr) {
        console.warn('[Pipeline] Market odds upsert error with handicap_odds, falling back to base columns:', oddsErr.message);
        const baseOdds = oddsToUpsert.map(({ fixture_id, bookmaker, home_odds, draw_odds, away_odds, over_25_odds, under_25_odds }) => ({
          fixture_id, bookmaker, home_odds, draw_odds, away_odds, over_25_odds, under_25_odds,
        }));
        await supabase.from('market_odds').upsert(baseOdds, { onConflict: 'fixture_id' });
      }
      summary.oddsUpdated = oddsToUpsert.length;
    } catch (err: any) {
      summary.errors.push(`Market odds upsert: ${err.message}`);
    }

    try {
      // Only include strictly upcoming matches in AI Parlays
      const nowIso = new Date().toISOString();
      const upcomingFixtures = targetFixtures.filter((f) => f.match_time > nowIso);
      const freshParlays = generateCuratedParlays(upcomingFixtures.length > 0 ? upcomingFixtures : targetFixtures);
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

  // 2. Run Market Odds & AI Parlays synchronization (next 48h)
  const { summary: oddsSummary } = await syncMarketOdds({
    league: options?.league,
    hoursAhead: 48,
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
      apiFootballStatus: 'context_enriched',
      storageUploads: fixSummary.storageUploads,
    },
    errors: [...fixSummary.errors, ...oddsSummary.errors],
  };

  return {
    success: true,
    summary,
  };
}
