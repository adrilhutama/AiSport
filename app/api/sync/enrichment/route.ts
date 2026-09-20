import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncLeagueEnrichment, ALL_SUPPORTED_LEAGUES } from '../pipeline';
import { LeagueCode } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Immediate Refresh Route: GET /api/sync/enrichment?league=PL
 * Pulls real 5-match form from Football-Data.org Standings
 * and live injuries from API-Sports v3 (with 2026 -> 2025 season fallback).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');
  const leagueParam = (searchParams.get('league') || 'PL').toUpperCase() as LeagueCode;

  // Protect route if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryToken !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing bearer token' },
      { status: 401 }
    );
  }

  if (!ALL_SUPPORTED_LEAGUES.includes(leagueParam)) {
    return NextResponse.json(
      {
        error: `Invalid league parameter '${leagueParam}'. Supported: ${ALL_SUPPORTED_LEAGUES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  try {
    const summary = await syncLeagueEnrichment(leagueParam);

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch {}

    return NextResponse.json(
      {
        success: true,
        league: summary.league,
        teams_count: summary.teamsUpdated,
        standings_synced: summary.standingsCount,
        injuries_count: summary.injuriesCount,
        season_used: summary.seasonUsed,
        api_sports_remaining: summary.remainingQuota,
        teams: summary.teams,
        errors: summary.errors,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Enrichment Route] Error:', error);
    return NextResponse.json(
      {
        success: false,
        league: leagueParam,
        message: 'Enrichment sync error caught gracefully',
        errors: [error.message || 'Unknown enrichment sync failure'],
      },
      { status: 200 }
    );
  }
}
