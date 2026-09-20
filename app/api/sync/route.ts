import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runOrchestrationPipeline } from './pipeline';

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
    const { searchParams } = new URL(request.url);
    const queryToken = searchParams.get('token');
    if (queryToken !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing bearer token' },
        { status: 401 }
      );
    }
  }

  try {
    const { success, summary } = await runOrchestrationPipeline();

    // Revalidate App Router caches
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
    } catch (revalErr) {
      console.warn('revalidatePath warning:', revalErr);
    }

    return NextResponse.json({
      success,
      message: 'Multi-API orchestration pipeline completed successfully',
      summary,
    });
  } catch (error: any) {
    console.error('[Sync Route] Orchestration pipeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown pipeline execution failure',
      },
      { status: 500 }
    );
  }
}
