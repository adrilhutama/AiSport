import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncFixturesAndTeams } from '../pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');
  const leagueParam = searchParams.get('league') || undefined;
  const batchParam = searchParams.get('batch') === 'true';

  // Protect route if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryToken !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing bearer token' },
      { status: 401 }
    );
  }

  try {
    const { success, summary } = await syncFixturesAndTeams({
      league: leagueParam,
      batch: batchParam,
    });

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch {}

    return NextResponse.json(
      {
        success,
        synced_leagues: summary.leaguesProcessed,
        fixtures_count: summary.fixturesUpdated,
        teams_count: summary.teamsUpdated,
        date_range: summary.dateRange,
        message: 'Rolling 7-day fixtures and teams synchronized successfully',
        summary,
        errors: summary.errors || [],
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Sync Fixtures Route] Error:', error);
    return NextResponse.json(
      {
        success: false,
        synced_leagues: leagueParam ? [leagueParam] : [],
        message: 'Fixtures sync error caught gracefully',
        errors: [error.message || 'Unknown fixtures sync failure'],
      },
      { status: 200 }
    );
  }
}
