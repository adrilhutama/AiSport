import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runOrchestrationPipeline } from './pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');
  const requestedLeague = searchParams.get('league') || undefined;
  const requestedBatch = searchParams.get('batch') === 'true';

  // Protect route if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryToken !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing bearer token' },
      { status: 401 }
    );
  }

  try {
    const { success, summary } = await runOrchestrationPipeline({
      league: requestedLeague,
      batch: requestedBatch,
    });

    // Revalidate App Router caches
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch (revalErr) {
      console.warn('revalidatePath warning:', revalErr);
    }

    return NextResponse.json({
      success: true,
      synced_leagues: summary.leaguesProcessed,
      message: 'Multi-API orchestration pipeline completed successfully',
      summary,
      errors: summary.errors || [],
    });
  } catch (error: any) {
    console.error('[Sync Route] Orchestration pipeline error:', error);
    // Never crash GitHub Actions or Vercel with 500; return HTTP 200 with error summary
    return NextResponse.json(
      {
        success: false,
        synced_leagues: requestedLeague ? [requestedLeague] : [],
        message: 'Pipeline execution error caught gracefully',
        errors: [error.message || 'Unknown pipeline execution failure'],
      },
      { status: 200 }
    );
  }
}
