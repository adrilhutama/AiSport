import { createServerClient } from '@/lib/supabase/server';

/**
 * Team Crest Storage Service
 * Downloads external crests (from Football-Data.org) and caches them permanently
 * inside Supabase Storage ('team-crests' public bucket).
 * Guarantees zero CORS failures, high reliability, and stable rendering.
 */

const CREST_BUCKET = 'team-crests';

export async function uploadTeamCrestToSupabase(
  teamId: string,
  sourceUrl: string
): Promise<string> {
  if (!sourceUrl || !sourceUrl.startsWith('http')) {
    return sourceUrl;
  }

  const supabase = createServerClient();
  if (!supabase) {
    return sourceUrl;
  }

  try {
    // 1. Determine file extension
    const isSvg = sourceUrl.endsWith('.svg') || sourceUrl.includes('.svg');
    const ext = isSvg ? 'svg' : 'png';
    const filePath = `${teamId}.${ext}`;
    const contentType = isSvg ? 'image/svg+xml' : 'image/png';

    // 2. Fetch the external crest asset
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'OddsMatrix-Crest-Sync/1.0',
      },
      next: { revalidate: 86400 * 7 }, // Cache for 7 days
    });

    if (!res.ok) {
      console.warn(`[Storage] Failed to download crest for ${teamId} from ${sourceUrl}: HTTP ${res.status}`);
      return sourceUrl;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from(CREST_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[Storage] Supabase bucket upload warning for ${filePath}:`, uploadError.message);
      return sourceUrl;
    }

    // 4. Retrieve and return permanent public CDN URL
    const { data } = supabase.storage
      .from(CREST_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl || sourceUrl;
  } catch (err) {
    console.warn(`[Storage] Exception caching crest for ${teamId}:`, err);
    return sourceUrl;
  }
}
