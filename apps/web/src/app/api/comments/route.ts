import type { NextRequest } from 'next/server';
import { commentInput } from '@bcm10/validation';
import { createClient } from '@bcm10/database/server';
import { badRequest, json, rateLimit, tooManyRequests, unauthorized, visitorHash } from '@/lib/api';

/**
 * Posting a comment.
 *
 * Signed-in readers only, and every comment lands unapproved. That is a
 * deliberate choice for a regional news site: unmoderated comments on political
 * stories are a legal exposure in India, not just a tone problem.
 *
 * RLS does the authorization — the insert policy requires profile_id to match
 * the caller and the article to be published with comments open — so this
 * handler only shapes input and rate-limits.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized('Sign in to comment.');

  // Keyed by user, not by IP: an account is the unit of abuse here, and several
  // readers legitimately share an office connection.
  const limit = rateLimit(`comment:${user.id}`, { limit: 5, windowSeconds: 300 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const parsed = commentInput.safeParse(body);
  if (!parsed.success) return badRequest('Write something first.');

  const { error } = await supabase.from('comments').insert({
    article_id: parsed.data.articleId,
    parent_id: parsed.data.parentId ?? null,
    profile_id: user.id,
    body: parsed.data.body,
  });

  if (error) {
    // The most common cause is comments being closed on that story, which is a
    // normal editorial state rather than a fault.
    return json({ ok: false, message: 'Comments are not open on this story.' }, { status: 403 });
  }

  // The visitor hash is recorded against nothing here; it exists so the rate
  // limiter has a fallback key if we ever allow signed-out comments.
  void visitorHash(request);

  return json({
    ok: true,
    message: 'Thanks — your comment will appear once an editor has read it.',
  });
}
