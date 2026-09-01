import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@bcm10/database/admin';
import { CacheTags } from '@bcm10/database';
import { authoriseInternal, json, serverError, unauthorized } from '@/lib/api';

/**
 * Rebuilds the "most read" materialised view.
 *
 * Computing most-read from `article_views` on every homepage request would
 * scan a table that grows by a row per read. A materialised view refreshed on
 * a schedule turns that into an indexed lookup, and `REFRESH ... CONCURRENTLY`
 * inside the RPC means readers never see an empty view mid-refresh.
 *
 * Also folds recent views into `articles.view_count`, so the lifetime counter
 * advances without a per-view trigger serialising writes on a hot story.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!authoriseInternal(request, 'CRON_SECRET')) return unauthorized();

  const supabase = createAdminClient();

  const [trending, stats] = await Promise.all([
    supabase.rpc('refresh_trending'),
    supabase.rpc('refresh_article_stats', { p_since: '01:00:00' }),
  ]);

  if (trending.error) {
    console.error('refresh_trending failed', trending.error.message);
    return serverError('Could not refresh trending');
  }

  if (stats.error) {
    // Non-fatal: the trending view is the part the homepage depends on.
    console.error('refresh_article_stats failed', stats.error.message);
  }

  revalidateTag(CacheTags.trending);

  return json({ ok: true, articlesCounted: stats.data ?? 0 });
}
