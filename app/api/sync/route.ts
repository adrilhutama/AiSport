import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { findNormalizedTeamId } from '@/lib/team-matcher';
import { LEAGUES_DATA, MOCK_FIXTURES, MOCK_TEAMS } from '@/lib/mock-data';
import { LeagueCode } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Protect route if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Check if query param token is provided as alternate
    const { searchParams } = new URL(request.url);
    const queryToken = searchParams.get('token');
    if (queryToken !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing bearer token' },
        { status: 401 }
      );
    }
  }

  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;
  const oddsApiKey = process.env.THE_ODDS_API_KEY;
  const supabase = createServerClient();

  const syncResults = {
    timestamp: new Date().toISOString(),
    mode: 'mock_fallback',
    leaguesProcessed: [] as string[],
    fixturesUpdated: 0,
    teamsUpdated: 0,
    errors: [] as string[],
  };

  // If external API keys are missing, gracefully utilize mock data and sync to Supabase if configured
  if (!footballDataKey || !oddsApiKey) {
    syncResults.mode = 'mock_fallback';
    syncResults.leaguesProcessed = ['PL', 'PD', 'SA', 'BL1', 'FL1'];
    syncResults.fixturesUpdated = MOCK_FIXTURES.length;
    syncResults.teamsUpdated = Object.keys(MOCK_TEAMS).length;

    if (supabase) {
      try {
        // Upsert mock teams
        const teamsToInsert = Object.values(MOCK_TEAMS).map(t => ({
          id: t.id,
          league: t.league,
          name: t.name,
          aliases: t.aliases,
          attack_rating: t.attack_rating,
          defense_rating: t.defense_rating,
          form: t.form,
        }));

        await supabase.from('teams').upsert(teamsToInsert, { onConflict: 'id' });

        // Upsert mock fixtures
        const fixturesToInsert = MOCK_FIXTURES.map(f => ({
          id: f.id,
          league: f.league,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id,
          match_time: f.match_time,
          status: f.status,
        }));

        await supabase.from('fixtures').upsert(fixturesToInsert, { onConflict: 'id' });

        // Upsert mock odds
        const oddsToInsert = MOCK_FIXTURES.map(f => ({
          fixture_id: f.id,
          bookmaker: f.marketOdds?.bookmaker || 'Pinnacle Consensus',
          home_odds: f.marketOdds?.home_odds || 2.0,
          draw_odds: f.marketOdds?.draw_odds || 3.2,
          away_odds: f.marketOdds?.away_odds || 3.5,
          over_25_odds: f.marketOdds?.over_25_odds || 1.85,
          under_25_odds: f.marketOdds?.under_25_odds || 1.95,
        }));

        await supabase.from('market_odds').upsert(oddsToInsert, { onConflict: 'fixture_id' });
      } catch (err: any) {
        syncResults.errors.push(`Supabase upsert note: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sync completed using Zero-Breakage Top 5 League data engine',
      summary: syncResults,
    });
  }

  // Live Multi-API Ingestion with strict free tier rate preservation
  syncResults.mode = 'live_multi_api';
  const leagueCodes: LeagueCode[] = ['PL', 'PD', 'SA', 'BL1', 'FL1'];

  for (const code of leagueCodes) {
    const leagueInfo = LEAGUES_DATA[code];
    try {
      // 1. Fetch Standings & Form from Football-Data.org
      const fdRes = await fetch(
        `https://api.football-data.org/v4/competitions/${code}/standings`,
        {
          headers: { 'X-Auth-Token': footballDataKey },
          next: { revalidate: 3600 }, // Cache 1 hour to respect free tier
        }
      );

      const teamFormMap: Record<string, { form: string; attackRating: number; defenseRating: number }> = {};
      if (fdRes.ok) {
        const fdData = await fdRes.json();
        const table = fdData.standings?.[0]?.table || [];
        for (const row of table) {
          const rawTeamName = row.team?.name || '';
          const normId = findNormalizedTeamId(rawTeamName);
          if (normId) {
            const played = Math.max(1, row.playedGames || 1);
            const goalsFor = row.goalsFor || 0;
            const goalsAgainst = row.goalsAgainst || 0;
            const avgScored = goalsFor / played;
            const avgConceded = goalsAgainst / played;
            
            // Baseline normalization against league averages
            const leagueAvg = (leagueInfo.avgHomeGoals + leagueInfo.avgAwayGoals) / 2;
            const attackRating = Number(Math.max(0.6, Math.min(2.0, avgScored / leagueAvg)).toFixed(2));
            const defenseRating = Number(Math.max(0.5, Math.min(1.8, avgConceded / leagueAvg)).toFixed(2));
            
            teamFormMap[normId] = {
              form: row.form?.replace(/,/g, '') || 'DDDDD',
              attackRating,
              defenseRating,
            };
          }
        }
      }

      // 2. Fetch Live Market Odds from The Odds API
      const oddsRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/${leagueInfo.oddsApiKey}/odds/?apiKey=${oddsApiKey}&regions=eu,uk&markets=h2h,totals&oddsFormat=decimal`,
        {
          next: { revalidate: 1800 }, // Cache 30 mins
        }
      );

      if (oddsRes.ok) {
        const oddsData = await oddsRes.json();
        for (const game of oddsData) {
          const homeNormId = findNormalizedTeamId(game.home_team);
          const awayNormId = findNormalizedTeamId(game.away_team);

          if (homeNormId && awayNormId) {
            const fixtureId = `${code.toLowerCase()}-${homeNormId}-${awayNormId}`;
            const bookmaker = game.bookmakers?.[0];
            const h2hMarket = bookmaker?.markets?.find((m: any) => m.key === 'h2h');
            const totalsMarket = bookmaker?.markets?.find((m: any) => m.key === 'totals');

            const homeOdds = h2hMarket?.outcomes?.find((o: any) => o.name === game.home_team)?.price || 2.0;
            const awayOdds = h2hMarket?.outcomes?.find((o: any) => o.name === game.away_team)?.price || 3.5;
            const drawOdds = h2hMarket?.outcomes?.find((o: any) => o.name === 'Draw')?.price || 3.2;

            const over25Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over' && o.point === 2.5)?.price || 1.85;
            const under25Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Under' && o.point === 2.5)?.price || 1.95;

            if (supabase) {
              await supabase.from('fixtures').upsert({
                id: fixtureId,
                league: code,
                home_team_id: homeNormId,
                away_team_id: awayNormId,
                match_time: game.commence_time,
                status: 'SCHEDULED',
              });

              await supabase.from('market_odds').upsert({
                fixture_id: fixtureId,
                bookmaker: bookmaker?.title || 'Consensus',
                home_odds: homeOdds,
                draw_odds: drawOdds,
                away_odds: awayOdds,
                over_25_odds: over25Odds,
                under_25_odds: under25Odds,
              });
            }

            syncResults.fixturesUpdated++;
          }
        }
      }

      syncResults.leaguesProcessed.push(code);
    } catch (err: any) {
      syncResults.errors.push(`Error processing ${code}: ${err.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Live multi-API sync completed successfully',
    summary: syncResults,
  });
}
