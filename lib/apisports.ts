import { LeagueCode, Team, MissingPlayer } from '@/types';

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

/**
 * Fetch active injuries for a given competition from API-Football v3
 * Calls: /injuries?league={leagueId}&season=2026
 */
export async function fetchLeagueInjuries(
  leagueCode: LeagueCode,
  season = 2026
): Promise<{
  success: boolean;
  injuriesByTeam: Record<string, MissingPlayer[]>;
  remainingQuota?: number;
}> {
  const apiKey =
    process.env.API_SPORTS_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return { success: false, injuriesByTeam: {} };
  }

  const leagueId = APISPORTS_LEAGUE_MAP[leagueCode];
  if (!leagueId) {
    return { success: false, injuriesByTeam: {} };
  }

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/injuries?league=${leagueId}&season=${season}`,
      {
        headers: { 'x-apisports-key': apiKey },
        next: { revalidate: 3600 * 6 }, // Cache for 6 hours
        signal: AbortSignal.timeout(6000),
      }
    );

    const remainingHeader = res.headers.get('x-ratelimit-requests-remaining');
    const remainingQuota = remainingHeader ? parseInt(remainingHeader, 10) : undefined;

    // Explicit console logging as required by specification
    console.log(`[API-Sports] Fetched injuries for league ${leagueId}. Requests remaining: ${remainingQuota ?? 'unspecified'}`);

    if (remainingQuota !== undefined && remainingQuota < 20) {
      console.warn(`[API-Sports] Remaining daily quota (${remainingQuota}) below 20 safeguard. Preserving quota.`);
      return { success: false, injuriesByTeam: {}, remainingQuota };
    }

    if (!res.ok) {
      console.warn(`[API-Sports] Injuries request for league ${leagueId} returned HTTP ${res.status}`);
      return { success: false, injuriesByTeam: {}, remainingQuota };
    }

    const data = await res.json();
    const injuries = data.response || [];
    const injuriesByTeam: Record<string, MissingPlayer[]> = {};

    for (const item of injuries) {
      const teamName = item.team?.name?.toLowerCase().trim();
      const playerName = item.player?.name || 'Unknown';
      const position = item.player?.type || 'Starter';
      const reason = item.player?.reason || 'Injury';

      if (teamName) {
        if (!injuriesByTeam[teamName]) {
          injuriesByTeam[teamName] = [];
        }
        injuriesByTeam[teamName].push({
          name: playerName,
          position,
          reason,
        });
      }
    }

    return { success: true, injuriesByTeam, remainingQuota };
  } catch (err: any) {
    console.warn(`[API-Sports] Error fetching injuries for league ${leagueId}:`, err.message);
    return { success: false, injuriesByTeam: {} };
  }
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
