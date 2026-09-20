import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface GradeLegResult {
  isSettled: boolean;
  isWon: boolean;
}

function gradeLeg(
  market: string,
  selection: string,
  scoreHome: number,
  scoreAway: number
): GradeLegResult {
  const m = market.toUpperCase();
  const s = selection.trim();
  const totalGoals = scoreHome + scoreAway;
  const goalDiff = scoreHome - scoreAway;

  // 1. 1X2 Market
  if (m === '1X2') {
    if (s === '1' || s.toLowerCase().includes('home')) {
      return { isSettled: true, isWon: scoreHome > scoreAway };
    }
    if (s === 'X' || s.toLowerCase().includes('draw')) {
      return { isSettled: true, isWon: scoreHome === scoreAway };
    }
    if (s === '2' || s.toLowerCase().includes('away')) {
      return { isSettled: true, isWon: scoreAway > scoreHome };
    }
  }

  // 2. Totals Market
  if (m === 'TOTALS' || m === 'OVER/UNDER') {
    const isOver = s.toLowerCase().startsWith('over') || s.startsWith('O ');
    const isUnder = s.toLowerCase().startsWith('under') || s.startsWith('U ');
    const lineMatch = s.match(/([0-9]+\.?[0-9]*)/);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 2.5;

    if (isOver) {
      return { isSettled: true, isWon: totalGoals > line };
    }
    if (isUnder) {
      return { isSettled: true, isWon: totalGoals < line };
    }
  }

  // 3. Asian Handicap Market
  if (m === 'ASIAN HANDICAP' || m === 'SPREADS') {
    if (s.toLowerCase().includes('home -0.5') || s === '-0.5') {
      return { isSettled: true, isWon: goalDiff >= 1 };
    }
    if (s.toLowerCase().includes('away +0.5') || s === '+0.5') {
      return { isSettled: true, isWon: goalDiff <= 0 };
    }
    if (s.toLowerCase().includes('home -1.5') || s === '-1.5') {
      return { isSettled: true, isWon: goalDiff >= 2 };
    }
    if (s.toLowerCase().includes('away +1.5') || s === '+1.5') {
      return { isSettled: true, isWon: goalDiff <= 1 };
    }
  }

  // 4. Both Teams to Score (BTTS)
  if (m === 'BTTS') {
    const isYes = s.toLowerCase() === 'yes' || s.toLowerCase() === 'btts_yes';
    const isNo = s.toLowerCase() === 'no' || s.toLowerCase() === 'btts_no';
    const bothScored = scoreHome > 0 && scoreAway > 0;

    if (isYes) {
      return { isSettled: true, isWon: bothScored };
    }
    if (isNo) {
      return { isSettled: true, isWon: !bothScored };
    }
  }

  return { isSettled: false, isWon: false };
}

export async function GET(request: NextRequest) {
  return handleSettlement(request);
}

export async function POST(request: NextRequest) {
  return handleSettlement(request);
}

async function handleSettlement(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');

  // Protect route if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryToken !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing bearer token' },
      { status: 401 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({
      success: true,
      message: 'Settlement engine executed in mock mode (no Supabase connection)',
      settled_fixtures_count: 0,
      settled_parlays_count: 0,
      errors: [],
    });
  }

  const errors: string[] = [];
  let settledFixturesCount = 0;
  let settledParlaysCount = 0;

  try {
    // 1. Fetch finished matches that have scores
    const { data: finishedFixtures, error: fixErr } = await supabase
      .from('fixtures')
      .select('id, status, score_home, score_away')
      .eq('status', 'FINISHED')
      .not('score_home', 'is', null)
      .not('score_away', 'is', null);

    if (fixErr) {
      errors.push(`Finished fixtures query: ${fixErr.message}`);
    }

    const fixtureScoreMap = new Map<string, { home: number; away: number }>();
    if (finishedFixtures && finishedFixtures.length > 0) {
      for (const f of finishedFixtures) {
        if (typeof f.score_home === 'number' && typeof f.score_away === 'number') {
          fixtureScoreMap.set(f.id, { home: f.score_home, away: f.score_away });
        }
      }
      settledFixturesCount = finishedFixtures.length;
    }

    // 2. Fetch pending AI Parlays
    const { data: pendingParlays, error: parlayErr } = await supabase
      .from('ai_parlays')
      .select('*')
      .eq('status', 'pending');

    if (parlayErr) {
      errors.push(`Pending parlays query: ${parlayErr.message}`);
    }

    if (pendingParlays && pendingParlays.length > 0 && fixtureScoreMap.size > 0) {
      const nowIso = new Date().toISOString();
      const historyRecords: any[] = [];

      for (const parlay of pendingParlays) {
        const legs = typeof parlay.legs === 'string' ? JSON.parse(parlay.legs) : parlay.legs || [];
        let allLegsSettled = true;
        let parlayWon = true;

        for (const leg of legs) {
          const score = fixtureScoreMap.get(leg.fixtureId);
          if (!score) {
            allLegsSettled = false;
            break;
          }

          const grade = gradeLeg(leg.market, leg.selection, score.home, score.away);
          if (!grade.isSettled) {
            allLegsSettled = false;
            break;
          }

          if (!grade.isWon) {
            parlayWon = false;
          }
        }

        if (allLegsSettled) {
          const newStatus = parlayWon ? 'won' : 'lost';
          const pnl = parlayWon
            ? Number((Number(parlay.total_odds) - 1.0).toFixed(2))
            : -1.0;

          // Update parlay status
          await supabase
            .from('ai_parlays')
            .update({ status: newStatus, settled_at: nowIso })
            .eq('id', parlay.id);

          settledParlaysCount++;

          // Record in bet_history
          historyRecords.push({
            parlay_id: parlay.id,
            market: 'Accumulator',
            selection: `${parlay.category.toUpperCase()} Slip`,
            odds: Number(parlay.total_odds),
            result: newStatus,
            pnl,
            settled_at: nowIso,
          });
        }
      }

      // Bulk insert bet_history
      if (historyRecords.length > 0) {
        try {
          await supabase.from('bet_history').insert(historyRecords);
        } catch (bhErr: any) {
          errors.push(`bet_history insert: ${bhErr.message}`);
        }
      }
    }

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Matchday settlement and history tracking completed successfully',
      settled_fixtures_count: settledFixturesCount,
      settled_parlays_count: settledParlaysCount,
      errors,
    });
  } catch (error: any) {
    console.error('[Settlement Route] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Settlement execution caught error',
      settled_fixtures_count: 0,
      settled_parlays_count: 0,
      errors: [error.message || 'Unknown settlement failure'],
    }, { status: 200 });
  }
}
