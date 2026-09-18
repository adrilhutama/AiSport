import { NextResponse } from 'next/server';
import { getOddsMatrixData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export interface LiveMatchPayload {
  id: string | number;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number | string | null;
}

export async function GET() {
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;

  let liveMatches: LiveMatchPayload[] = [];
  let nextKickoff: string | null = null;

  try {
    if (footballDataKey) {
      const res = await fetch(
        'https://api.football-data.org/v4/matches?status=IN_PLAY,PAUSED',
        {
          headers: { 'X-Auth-Token': footballDataKey },
          next: { revalidate: 45 },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawMatches = data.matches || [];
        liveMatches = rawMatches.map((m: any) => {
          const homeScore = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
          const awayScore = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;
          return {
            id: m.id,
            league: m.competition?.code || m.competition?.name,
            homeTeam: m.homeTeam?.shortName || m.homeTeam?.name || 'Home',
            awayTeam: m.awayTeam?.shortName || m.awayTeam?.name || 'Away',
            homeCrest: m.homeTeam?.crest || null,
            awayCrest: m.awayTeam?.crest || null,
            homeScore,
            awayScore,
            status: m.status,
            minute: m.minute || (m.status === 'PAUSED' ? 'HT' : 'LIVE'),
          };
        });
      }
    }

    // Determine nearest upcoming kickoff from active fixtures
    const matrixData = await getOddsMatrixData();
    const now = new Date();
    const upcoming = matrixData.fixtures
      .filter((f) => new Date(f.match_time).getTime() > now.getTime())
      .sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());

    if (upcoming.length > 0) {
      nextKickoff = upcoming[0].match_time;
    }
  } catch (error: any) {
    console.error('[LiveScore API] Error fetching live matches:', error);
  }

  return NextResponse.json(
    {
      success: true,
      matches: liveMatches,
      nextKickoff,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=60',
      },
    }
  );
}
