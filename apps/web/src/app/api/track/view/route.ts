import type { NextRequest } from 'next/server';
import { articleViewInput } from '@bcm10/validation';
import { createClient } from '@bcm10/database/server';
import { badRequest, deviceKind, json, rateLimit, tooManyRequests, visitorHash } from '@/lib/api';

/**
 * First-party view recording.
 *
 * Exists alongside PostHog rather than instead of it. "Most read" and B2B
 * licence reporting must keep working when a reader runs an ad-blocker, and
 * they must be auditable from our own database rather than a vendor's UI.
 *
 * The write goes through the `record_article_view` RPC, which is SECURITY
 * DEFINER — `article_views` has no INSERT policy at all, so this endpoint is
 * the only way a row can appear, and the RPC re-checks that the article is
 * actually published before writing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const hash = visitorHash(request);

  // Generous, because a reader legitimately opens many stories in a session;
  // tight enough that a script cannot inflate a story's count.
  const limit = rateLimit(`view:${hash}`, { limit: 60, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const parsed = articleViewInput.safeParse(body);
  if (!parsed.success) return badRequest('Invalid payload');

  const supabase = await createClient();

  const { error } = await supabase.rpc('record_article_view', {
    p_article_id: parsed.data.articleId,
    p_visitor_hash: hash,
    p_referrer_host: parsed.data.referrerHost ?? null,
    p_device_kind: deviceKind(request.headers.get('user-agent')),
    p_read_depth: parsed.data.readDepth ?? null,
  });

  if (error) {
    // A failed count must never surface to the reader as a broken page.
    console.error('record_article_view failed', error.message);
  }

  return json({ ok: true });
}
