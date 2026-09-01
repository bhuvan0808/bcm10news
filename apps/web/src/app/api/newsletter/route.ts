import type { NextRequest } from 'next/server';
import { newsletterSignupInput } from '@bcm10/validation';
import { createClient } from '@bcm10/database/server';
import { createEmailService, newsletterConfirmEmail } from '@bcm10/email';
import { badRequest, json, rateLimit, serverError, tooManyRequests, visitorHash } from '@/lib/api';
import { SITE, absoluteUrl } from '@/lib/site';

/**
 * Newsletter sign-up.
 *
 * The subscriber list is not readable by anonymous callers — `newsletter_subscribers`
 * has no public SELECT policy — so the insert goes through the
 * `subscribe_to_newsletter` RPC, which is SECURITY DEFINER and returns only
 * the confirmation token it just generated.
 *
 * Sign-up is double opt-in: a row exists but `is_confirmed` stays false until
 * the reader clicks through. That is both good deliverability practice and the
 * thing that stops someone subscribing an address they do not own.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const limit = rateLimit(`newsletter:${visitorHash(request)}`, { limit: 5, windowSeconds: 300 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const parsed = newsletterSignupInput.safeParse(body);
  if (!parsed.success) {
    return badRequest('Enter a valid email address');
  }

  // Honeypot. A filled field means a bot; answer as if it worked so the bot
  // does not learn what tripped it, but write nothing.
  if (parsed.data.website) {
    return json({ ok: true, message: 'Check your inbox to confirm.' });
  }

  const supabase = await createClient();

  const { data: token, error } = await supabase.rpc('subscribe_to_newsletter', {
    p_email: parsed.data.email,
    p_kinds: parsed.data.kinds,
    p_language: parsed.data.language,
    p_source: parsed.data.source,
  });

  if (error) {
    console.error('subscribe_to_newsletter failed', error.message);
    return serverError('We could not sign you up just now. Please try again.');
  }

  if (token) {
    const email = createEmailService();
    const result = await email.send(
      newsletterConfirmEmail(
        { siteName: SITE.name, siteUrl: SITE.origin, language: parsed.data.language },
        {
          to: parsed.data.email,
          confirmUrl: absoluteUrl(`/newsletter/confirm?token=${encodeURIComponent(token)}`),
        }
      )
    );

    if (!result.ok) console.error('Confirmation email failed', result.error);
  }

  return json({ ok: true, message: 'Almost there — check your inbox to confirm.' });
}
