import { LeagueCode, Team, MissingPlayer } from '@/types';
import { findNormalizedTeamId, cleanTeamString } from '@/lib/team-matcher';

/**
 * API-Sports / API-Football v3 Contextual Intelligence Service
 * Ingests injury reports, key missing starters, and rolling team xG metrics.
 * Protects daily quota with a strict 20-request remaining safeguard.
 */

export const APISPORTS_LEAGUE_MAP: Record<LeagueCode, number> = {
  PL: 39,   // Premier League
  PD: 140,  // La Liga
  SA: 135,  // Serie A
  BL1: 78,  // Bundesliga
  FL1: 61,  // Ligue 1
  CL: 2,    // UEFA Champions League
  EL: 3,    // UEFA Europa League
};

export interface TeamContextData {
  missing_players: (string | MissingPlayer)[];
  key_injuries_count: number;
  rolling_xg: number | null;
  avg_xg_for: number | null;
  avg_xg_against: number | null;
}

export interface InjuriesFetchResult {
  success: boolean;
  injuriesByTeam: Record<string, MissingPlayer[]>;
  remainingQuota?: number;
  totalInjuries: number;
  seasonUsed?: number;
}

/**
 * Fetch active injuries for a given competition from API-Football v3
 * Calls: /injuries?league={leagueId}&season={season}
 * Automatically falls back to season 2025 if season 2026 returns 0 injuries.
 */
export async function fetchLeagueInjuries(
  leagueCode: LeagueCode,
  season = 2026
): Promise<InjuriesFetchResult> {
  const apiKey =
    process.env.API_SPORTS_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return { success: false, injuriesByTeam: {}, totalInjuries: 0 };
  }

  const leagueId = APISPORTS_LEAGUE_MAP[leagueCode];
  if (!leagueId) {
    return { success: false, injuriesByTeam: {}, totalInjuries: 0 };
  }

  const querySeason = async (targetSeason: number) => {
    try {
      const res = await fetch(
        `https://v3.football.api-sports.io/injuries?league=${leagueId}&season=${targetSeason}`,
        {
          headers: { 'x-apisports-key': apiKey },
          next: { revalidate: 3600 * 6 }, // Cache for 6 hours
          signal: AbortSignal.timeout(6000),
        }
      );

      const remainingHeader = res.headers.get('x-ratelimit-requests-remaining');
      const remaining = remainingHeader ? parseInt(remainingHeader, 10) : undefined;

      // Specification log output format
      console.log(`[API-Sports] Syncing injuries for ${leagueCode}... Remaining: ${remaining ?? 'unspecified'}`);

      if (remaining !== undefined && remaining < 20) {
        console.warn(`[API-Sports] Remaining daily quota (${remaining}) below 20 safeguard. Preserving quota.`);
        return { ok: false, data: null, remaining, quotaHalted: true };
      }

      if (!res.ok) {
        console.warn(`[API-Sports] Injuries request for league ${leagueId} (season ${targetSeason}) returned HTTP ${res.status}`);
        return { ok: false, data: null, remaining, quotaHalted: false };
      }

      const data = await res.json();
      return { ok: true, data, remaining, quotaHalted: false };
    } catch (err: any) {
      console.warn(`[API-Sports] Request error for ${leagueCode} (season ${targetSeason}):`, err.message);
      return { ok: false, data: null, remaining: undefined, quotaHalted: false };
    }
  };

  let seasonUsed = season;
  let queryRes = await querySeason(seasonUsed);

  if (queryRes.quotaHalted) {
    return {
      success: false,
      injuriesByTeam: {},
      remainingQuota: queryRes.remaining,
      totalInjuries: 0,
      seasonUsed,
    };
  }

  let responseList = queryRes.data?.response || [];

  // Fallback: If season=2026 returns response: [], automatically fall back to season=2025
  if (responseList.length === 0 && seasonUsed === 2026) {
    console.log(`[API-Sports] Season 2026 returned empty injuries for ${leagueCode}. Falling back to season 2025...`);
    seasonUsed = 2025;
    const fallbackRes = await querySeason(seasonUsed);
    if (fallbackRes.ok && fallbackRes.data?.response?.length > 0) {
      queryRes = fallbackRes;
      responseList = fallbackRes.data.response;
    }
  }

  const injuriesByTeam: Record<string, MissingPlayer[]> = {};
  let totalInjuries = 0;

  for (const item of responseList) {
    const rawTeamName = item.team?.name || '';
    const normalizedId =
      findNormalizedTeamId(rawTeamName, leagueCode) ||
      cleanTeamString(rawTeamName);
    const teamKey = rawTeamName.toLowerCase().trim();

    const playerName = item.player?.name || 'Unknown';
    const position = item.player?.type || 'Unknown';
    const reason = item.player?.reason || 'Injured';

    const playerObj: MissingPlayer = {
      name: playerName,
      position,
      reason,
    };

    // Store under normalized ID
    if (normalizedId) {
      if (!injuriesByTeam[normalizedId]) injuriesByTeam[normalizedId] = [];
      if (!injuriesByTeam[normalizedId].some((p) => p.name === playerName)) {
        injuriesByTeam[normalizedId].push(playerObj);
        totalInjuries++;
      }
    }

    // Also store under raw team name key for fallback
    if (teamKey && teamKey !== normalizedId) {
      if (!injuriesByTeam[teamKey]) injuriesByTeam[teamKey] = [];
      if (!injuriesByTeam[teamKey].some((p) => p.name === playerName)) {
        injuriesByTeam[teamKey].push(playerObj);
      }
    }
  }

  return {
    success: true,
    injuriesByTeam,
    remainingQuota: queryRes.remaining,
    totalInjuries,
    seasonUsed,
  };
}

/**
 * Fetch team statistics from API-Football v3 (/teams/statistics)
 * Used to calibrate rolling xG metrics
 */
export async function fetchTeamStatistics(
  teamId: number,
  leagueId: number,
  season = 2026
): Promise<{ avgXgFor: number | null; avgXgAgainst: number | null }> {
  const apiKey =
    process.env.API_SPORTS_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.API_FOOTBALL_KEY;

  if (!apiKey || !teamId) {
    return { avgXgFor: null, avgXgAgainst: null };
  }

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`,
      {
        headers: { 'x-apisports-key': apiKey },
        next: { revalidate: 3600 * 12 },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) return { avgXgFor: null, avgXgAgainst: null };

    const data = await res.json();
    const goals = data.response?.goals;
    const avgFor = goals?.for?.average?.total ? parseFloat(goals.for.average.total) : null;
    const avgAgainst = goals?.against?.average?.total ? parseFloat(goals.against.average.total) : null;

    return { avgXgFor: avgFor, avgXgAgainst: avgAgainst };
  } catch {
    return { avgXgFor: null, avgXgAgainst: null };
  }
}

/**
 * Enriches an array of Team objects with API-Sports contextual metrics:
 * - Missing players & injury count
 * - Rolling xG and goal metrics
 */
export async function enrichTeamsWithContext(
  teams: Team[],
  leagueCode: LeagueCode
): Promise<Team[]> {
  const { injuriesByTeam, remainingQuota } = await fetchLeagueInjuries(leagueCode);
  const leagueId = APISPORTS_LEAGUE_MAP[leagueCode];

  return Promise.all(
    teams.map(async (team) => {
      const teamKey = team.name.toLowerCase().trim();
      const missing = injuriesByTeam[teamKey] || [];
      const injuryCount = missing.length;

      // Default baseline derived from attack rating and team profile
      let avgXgFor = team.avg_xg_for ?? Number((team.attack_rating * 1.40).toFixed(2));
      let avgXgAgainst = team.avg_xg_against ?? Number((team.defense_rating * 1.15).toFixed(2));

      // If quota permits (> 20 remaining) and team has a numeric external id, fetch statistics
      const numericTeamId = (team as any).api_football_id || (team as any).external_id;
      if (numericTeamId && leagueId && (remainingQuota === undefined || remainingQuota > 20)) {
        const stats = await fetchTeamStatistics(numericTeamId, leagueId);
        if (stats.avgXgFor) avgXgFor = stats.avgXgFor;
        if (stats.avgXgAgainst) avgXgAgainst = stats.avgXgAgainst;
      }

      const baseRollingXg = team.rolling_xg ?? avgXgFor;

      return {
        ...team,
        missing_players: missing.length > 0 ? missing : team.missing_players || [],
        key_injuries_count: Math.max(team.key_injuries_count || 0, injuryCount),
        rolling_xg: baseRollingXg,
        avg_xg_for: avgXgFor,
        avg_xg_against: avgXgAgainst,
      };
    })
  );
}
