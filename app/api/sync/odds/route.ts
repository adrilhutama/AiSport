import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncMarketOdds } from '../pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');
  const leagueParam = searchParams.get('league') || undefined;
  const hoursParam = searchParams.get('hours') ? parseInt(searchParams.get('hours')!, 10) : 72;

  // Protect route if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryToken !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing bearer token' },
      { status: 401 }
    );
  }

  try {
    const { success, summary } = await syncMarketOdds({
      league: leagueParam,
      hoursAhead: hoursParam,
    });

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch {}

    return NextResponse.json(
      {
        success,
        synced_leagues: summary.leaguesProcessed,
        odds_updated: summary.oddsUpdated,
        parlays_updated: summary.parlaysUpdated,
        quota_remaining: summary.oddsApiQuota.remaining,
        message: 'Market consensus odds and AI parlays synchronized successfully',
        summary,
        errors: summary.errors || [],
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Sync Odds Route] Error:', error);
    return NextResponse.json(
      {
        success: false,
        synced_leagues: leagueParam ? [leagueParam] : [],
        message: 'Market odds sync error caught gracefully',
        errors: [error.message || 'Unknown odds sync failure'],
      },
      { status: 200 }
    );
  }
}
