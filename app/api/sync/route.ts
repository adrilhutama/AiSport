import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { findNormalizedTeamId, cleanTeamString, getTeamLeague } from '@/lib/team-matcher';
import { LEAGUES_DATA, MOCK_FIXTURES, MOCK_TEAMS } from '@/lib/mock-data';
import { LeagueCode } from '@/types';

export const dynamic = 'force-dynamic';

function parseTeamForm(rawForm?: string | null): string {
  if (!rawForm) return 'WDLWW';
  const cleaned = rawForm.replace(/[^WDLwdl]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned.slice(-5) : 'WDLWW';
}

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
    oddsUpdated: 0,
    errors: [] as string[],
  };

  // --- MODE A: FALLBACK / MOCK ENGINE ---
  if (!footballDataKey || !oddsApiKey) {
    syncResults.mode = 'mock_fallback';
    syncResults.leaguesProcessed = ['PL', 'PD', 'SA', 'BL1', 'FL1'];

    if (supabase) {
      // 1. Step 1: Upsert Teams First
      const teamsToInsert = Object.values(MOCK_TEAMS).map(t => ({
        id: t.id,
        league: t.league,
        name: t.name,
        aliases: t.aliases || [],
        attack_rating: t.attack_rating,
        defense_rating: t.defense_rating,
        form: t.form && t.form !== 'N/A' ? t.form : 'WDLWW',
        crest_url: t.crest_url || null,
      }));

      const { error: teamsErr } = await supabase
        .from('teams')
        .upsert(teamsToInsert, { onConflict: 'id' });

      if (teamsErr) {
        console.error('[Sync] Error upserting teams (mock mode):', teamsErr);
        syncResults.errors.push(`Teams error: ${teamsErr.message} (code: ${teamsErr.code})`);
        return NextResponse.json(
          { success: false, error: 'Database foreign key failure on teams', details: syncResults },
          { status: 500 }
        );
      }
      syncResults.teamsUpdated = teamsToInsert.length;

      // 2. Step 2: Upsert Fixtures (after teams exist)
      const fixturesToInsert = MOCK_FIXTURES.map(f => ({
        id: f.id,
        league: f.league,
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        match_time: f.match_time,
        status: f.status || 'SCHEDULED',
      }));

      const { error: fixturesErr } = await supabase
        .from('fixtures')
        .upsert(fixturesToInsert, { onConflict: 'id' });

      if (fixturesErr) {
        console.error('[Sync] Error upserting fixtures (mock mode):', fixturesErr);
        syncResults.errors.push(`Fixtures error: ${fixturesErr.message} (code: ${fixturesErr.code})`);
        return NextResponse.json(
          { success: false, error: 'Database failure on fixtures', details: syncResults },
          { status: 500 }
        );
      }
      syncResults.fixturesUpdated = fixturesToInsert.length;

      // 3. Step 3: Upsert Market Odds (after fixtures exist)
      const oddsToInsert = MOCK_FIXTURES.map(f => ({
        fixture_id: f.id,
        bookmaker: f.marketOdds?.bookmaker || 'Pinnacle Consensus',
        home_odds: f.marketOdds?.home_odds || 2.0,
        draw_odds: f.marketOdds?.draw_odds || 3.2,
        away_odds: f.marketOdds?.away_odds || 3.5,
        over_25_odds: f.marketOdds?.over_25_odds || 1.85,
        under_25_odds: f.marketOdds?.under_25_odds || 1.95,
        handicap_odds: f.marketOdds?.handicap_odds || {},
        totals_odds: f.marketOdds?.totals_odds || {},
        btts_odds: f.marketOdds?.btts_odds || {},
      }));

      const { error: oddsErr } = await supabase
        .from('market_odds')
        .upsert(oddsToInsert, { onConflict: 'fixture_id' });

      if (oddsErr) {
        console.error('[Sync] Error upserting market odds (mock mode):', oddsErr);
        syncResults.errors.push(`Market odds error: ${oddsErr.message} (code: ${oddsErr.code})`);
        return NextResponse.json(
          { success: false, error: 'Database failure on market_odds', details: syncResults },
          { status: 500 }
        );
      }
      syncResults.oddsUpdated = oddsToInsert.length;
    } else {
      syncResults.fixturesUpdated = MOCK_FIXTURES.length;
      syncResults.teamsUpdated = Object.keys(MOCK_TEAMS).length;
    }

    // Invalidate Vercel / Next.js cache
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch (revalErr) {
      console.warn('revalidatePath warning:', revalErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Sync completed using Zero-Breakage Top 5 League data engine',
      summary: syncResults,
    });
  }

  // --- MODE B: LIVE MULTI-API INGESTION ---
  syncResults.mode = 'live_multi_api';
  const leagueCodes: LeagueCode[] = ['PL', 'PD', 'SA', 'BL1', 'FL1'];

  // Collector maps to accumulate relational data in memory
  const allTeamsMap = new Map<string, {
    id: string;
    league: string;
    name: string;
    aliases: string[];
    attack_rating: number;
    defense_rating: number;
    form: string;
    crest_url?: string | null;
  }>();

  // Pre-fill with baseline known teams so all standard slugs exist
  for (const [id, team] of Object.entries(MOCK_TEAMS)) {
    allTeamsMap.set(id, {
      id: team.id,
      league: team.league,
      name: team.name,
      aliases: team.aliases || [],
      attack_rating: team.attack_rating,
      defense_rating: team.defense_rating,
      form: team.form,
      crest_url: team.crest_url || null,
    });
  }

  const allFixturesMap = new Map<string, {
    id: string;
    league: string;
    home_team_id: string;
    away_team_id: string;
    match_time: string;
    status: string;
  }>();

  const allOddsMap = new Map<string, {
    fixture_id: string;
    bookmaker: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
    over_25_odds: number;
    under_25_odds: number;
    handicap_odds?: Record<string, number>;
    totals_odds?: Record<string, number>;
    btts_odds?: Record<string, number>;
  }>();

  for (const code of leagueCodes) {
    const leagueInfo = LEAGUES_DATA[code];
    try {
      // 1. Fetch Standings & Form from Football-Data.org
      const fdRes = await fetch(
        `https://api.football-data.org/v4/competitions/${code}/standings`,
        {
          headers: { 'X-Auth-Token': footballDataKey },
          next: { revalidate: 3600 },
        }
      );

      if (fdRes.ok) {
        const fdData = await fdRes.json();
        const table = fdData.standings?.[0]?.table || [];
        for (const row of table) {
          const rawTeamName = row.team?.name || '';
          const crestUrl = row.team?.crest || '';
          const normId = findNormalizedTeamId(rawTeamName, code) || cleanTeamString(rawTeamName).replace(/\s+/g, '-');
          if (normId) {
            const played = Math.max(1, row.playedGames || 1);
            const goalsFor = row.goalsFor || 0;
            const goalsAgainst = row.goalsAgainst || 0;
            const avgScored = goalsFor / played;
            const avgConceded = goalsAgainst / played;

            const leagueAvg = (leagueInfo.avgHomeGoals + leagueInfo.avgAwayGoals) / 2;
            const attackRating = Number(Math.max(0.6, Math.min(2.0, avgScored / leagueAvg)).toFixed(2));
            const defenseRating = Number(Math.max(0.5, Math.min(1.8, avgConceded / leagueAvg)).toFixed(2));

            allTeamsMap.set(normId, {
              id: normId,
              league: code,
              name: row.team?.name || normId,
              aliases: [rawTeamName],
              attack_rating: attackRating,
              defense_rating: defenseRating,
              form: parseTeamForm(row.form),
              crest_url: crestUrl || allTeamsMap.get(normId)?.crest_url || null,
            });
          }
        }
      }

      // 2. Fetch Live Market Odds from The Odds API
      const oddsRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/${leagueInfo.oddsApiKey}/odds/?apiKey=${oddsApiKey}&regions=eu,uk&markets=h2h,spreads,totals&oddsFormat=decimal`,
        {
          next: { revalidate: 1800 },
        }
      );

      if (oddsRes.ok) {
        const oddsData = await oddsRes.json();
        for (const game of oddsData) {
          // Strict league-isolated matching: only match teams against this league's roster
          const homeNormId = findNormalizedTeamId(game.home_team, code);
          const awayNormId = findNormalizedTeamId(game.away_team, code);

          // Both teams MUST resolve to valid teams within this competition
          if (!homeNormId || !awayNormId) {
            console.warn(`[Sync] League ${code}: Skipping fixture with unmapped team(s): "${game.home_team}" vs "${game.away_team}"`);
            continue;
          }

          if (homeNormId === awayNormId) {
            console.warn(`[Sync] League ${code}: Skipping fixture with identical team resolution: ${homeNormId}`);
            continue;
          }

          // Verify domestic league alignment
          const homeLeague = getTeamLeague(homeNormId) || allTeamsMap.get(homeNormId)?.league;
          const awayLeague = getTeamLeague(awayNormId) || allTeamsMap.get(awayNormId)?.league;

          if ((homeLeague && homeLeague !== code) || (awayLeague && awayLeague !== code)) {
            console.warn(`[Sync] Blocked cross-league pairing in ${code}: ${homeNormId} (${homeLeague}) vs ${awayNormId} (${awayLeague})`);
            continue;
          }

          // Guarantee both teams are registered in allTeamsMap before referencing
          if (!allTeamsMap.has(homeNormId)) {
            allTeamsMap.set(homeNormId, {
              id: homeNormId,
              league: code,
              name: game.home_team,
              aliases: [game.home_team],
              attack_rating: 1.0,
              defense_rating: 1.0,
              form: 'WDLWW',
              crest_url: null,
            });
          }

          if (!allTeamsMap.has(awayNormId)) {
            allTeamsMap.set(awayNormId, {
              id: awayNormId,
              league: code,
              name: game.away_team,
              aliases: [game.away_team],
              attack_rating: 1.0,
              defense_rating: 1.0,
              form: 'DWDWL',
              crest_url: null,
            });
          }

          const fixtureId = `${code.toLowerCase()}-${homeNormId}-${awayNormId}`;
          const bookmaker = game.bookmakers?.[0];
          const h2hMarket = bookmaker?.markets?.find((m: any) => m.key === 'h2h');
          const totalsMarket = bookmaker?.markets?.find((m: any) => m.key === 'totals');
          const spreadsMarket = bookmaker?.markets?.find((m: any) => m.key === 'spreads');

          const homeOdds = h2hMarket?.outcomes?.find((o: any) => o.name === game.home_team)?.price || 2.0;
          const awayOdds = h2hMarket?.outcomes?.find((o: any) => o.name === game.away_team)?.price || 3.5;
          const drawOdds = h2hMarket?.outcomes?.find((o: any) => o.name === 'Draw')?.price || 3.2;

          const over25Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over' && o.point === 2.5)?.price || 1.85;
          const under25Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Under' && o.point === 2.5)?.price || 1.95;

          const over15Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over' && o.point === 1.5)?.price || Number(Math.max(1.18, (over25Odds * 0.72)).toFixed(2));
          const under15Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Under' && o.point === 1.5)?.price || Number(Math.max(2.85, (under25Odds * 1.65)).toFixed(2));
          const over35Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over' && o.point === 3.5)?.price || Number(Math.max(2.15, (over25Odds * 1.70)).toFixed(2));
          const under35Odds = totalsMarket?.outcomes?.find((o: any) => o.name === 'Under' && o.point === 3.5)?.price || Number(Math.max(1.24, (under25Odds * 0.72)).toFixed(2));

          const handicap_odds: Record<string, number> = {
            'home_-1.5': Number((homeOdds * 1.52).toFixed(2)),
            'away_+1.5': Number(Math.max(1.28, Number((1.1 + (0.9 / (homeOdds > 1.2 ? homeOdds : 1.2))).toFixed(2)))),
            'home_-0.5': homeOdds,
            'away_+0.5': Number(Math.max(1.22, Number((1.05 + 1.2 / (homeOdds > 1.1 ? homeOdds : 1.1)).toFixed(2)))),
            'home_+0.5': Number(Math.max(1.22, Number((1.05 + 1.2 / (awayOdds > 1.1 ? awayOdds : 1.1)).toFixed(2)))),
            'away_-0.5': awayOdds,
            'home_+1.5': Number(Math.max(1.28, Number((1.1 + (0.9 / (awayOdds > 1.2 ? awayOdds : 1.2))).toFixed(2)))),
            'away_-1.5': Number((awayOdds * 1.52).toFixed(2)),
          };

          const totals_odds: Record<string, number> = {
            'over_1.5': over15Odds,
            'under_1.5': under15Odds,
            'over_2.5': over25Odds,
            'under_2.5': under25Odds,
            'over_3.5': over35Odds,
            'under_3.5': under35Odds,
          };

          const btts_odds: Record<string, number> = {
            'btts_yes': Number(Math.max(1.52, (over25Odds * 0.95)).toFixed(2)),
            'btts_no': Number(Math.max(1.68, (under25Odds * 1.05)).toFixed(2)),
          };

          allFixturesMap.set(fixtureId, {
            id: fixtureId,
            league: code,
            home_team_id: homeNormId,
            away_team_id: awayNormId,
            match_time: game.commence_time,
            status: 'SCHEDULED',
          });

          allOddsMap.set(fixtureId, {
            fixture_id: fixtureId,
            bookmaker: bookmaker?.title || 'Consensus',
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            over_25_odds: over25Odds,
            under_25_odds: under25Odds,
            handicap_odds,
            totals_odds,
            btts_odds,
          });
        }
      }

      syncResults.leaguesProcessed.push(code);
    } catch (err: any) {
      console.error(`[Sync] Error processing league ${code}:`, err);
      syncResults.errors.push(`Error processing ${code}: ${err.message}`);
    }
  }

  // --- STRICT RELATIONAL PERSISTENCE IN SUPABASE ---
  if (supabase) {
    try {
      // Step 1: Upsert ALL Teams First (Guarantees foreign keys exist)
      const teamsPayload = Array.from(allTeamsMap.values());
      const { error: teamsError } = await supabase
        .from('teams')
        .upsert(teamsPayload, { onConflict: 'id' });

      if (teamsError) {
        console.error('[Sync] Fatal: Teams upsert error in Supabase:', teamsError);
        syncResults.errors.push(`Teams error: ${teamsError.message} (code: ${teamsError.code})`);
        return NextResponse.json(
          { success: false, error: 'Database foreign key failure on teams', details: syncResults },
          { status: 500 }
        );
      }
      syncResults.teamsUpdated = teamsPayload.length;

      // Step 2: Upsert Fixtures (After all team IDs exist)
      const fixturesPayload = Array.from(allFixturesMap.values());
      const { error: fixturesError } = await supabase
        .from('fixtures')
        .upsert(fixturesPayload, { onConflict: 'id' });

      if (fixturesError) {
        console.error('[Sync] Fatal: Fixtures upsert error in Supabase:', fixturesError);
        syncResults.errors.push(`Fixtures error: ${fixturesError.message} (code: ${fixturesError.code})`);
        return NextResponse.json(
          { success: false, error: 'Database upsert failure on fixtures', details: syncResults },
          { status: 500 }
        );
      }
      syncResults.fixturesUpdated = fixturesPayload.length;

      // Step 3: Upsert Market Odds (After all fixture IDs exist)
      const oddsPayload = Array.from(allOddsMap.values());
      const { error: oddsError } = await supabase
        .from('market_odds')
        .upsert(oddsPayload, { onConflict: 'fixture_id' });

      if (oddsError) {
        console.error('[Sync] Fatal: Market odds upsert error in Supabase:', oddsError);
        syncResults.errors.push(`Market odds error: ${oddsError.message} (code: ${oddsError.code})`);
        return NextResponse.json(
          { success: false, error: 'Database upsert failure on market_odds', details: syncResults },
          { status: 500 }
        );
      }
      syncResults.oddsUpdated = oddsPayload.length;
    } catch (dbErr: any) {
      console.error('[Sync] Unexpected database exception:', dbErr);
      syncResults.errors.push(`Database exception: ${dbErr.message}`);
      return NextResponse.json(
        { success: false, error: 'Unexpected database exception', details: syncResults },
        { status: 500 }
      );
    }
  } else {
    syncResults.teamsUpdated = allTeamsMap.size;
    syncResults.fixturesUpdated = allFixturesMap.size;
    syncResults.oddsUpdated = allOddsMap.size;
  }

  // Trigger on-demand cache revalidation for Vercel CDN and Next.js App Router
  try {
    revalidatePath('/', 'layout');
    revalidatePath('/');
  } catch (revalErr) {
    console.warn('revalidatePath warning:', revalErr);
  }

  return NextResponse.json({
    success: true,
    message: 'Live multi-API sync completed successfully with strict relational order',
    summary: syncResults,
  });
}
