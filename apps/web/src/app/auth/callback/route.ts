import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@bcm10/database/server';

/**
 * OAuth / magic-link callback.
 *
 * Exchanges the one-time code for a session and writes the cookies. Two things
 * worth being careful about:
 *
 *  1. The `next` parameter is attacker-controllable. Only a site-relative path
 *     is honoured, or an open redirect turns our sign-in into a phishing hop.
 *  2. Behind a proxy, `request.url` carries the internal host. The forwarded
 *     host is used so the redirect lands on admin.bcm10news.in rather than on
 *     some Vercel internal origin.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/account?error=missing-code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback failed', error.message);
    return NextResponse.redirect(`${origin}/account?error=exchange-failed`);
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const base = !isLocal && forwardedHost ? `https://${forwardedHost}` : origin;

  return NextResponse.redirect(`${base}${next}`);
}

/** Site-relative paths only — never an absolute URL supplied by the caller. */
function safeNext(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}
