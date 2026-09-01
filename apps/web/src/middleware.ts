import type { NextRequest } from 'next/server';
import { updateSession } from '@bcm10/database/middleware';

/**
 * Session refresh.
 *
 * Server Components cannot write cookies, so a refreshed Supabase access token
 * has nowhere to land unless middleware writes it. Without this a reader is
 * silently signed out roughly an hour into a session — and on a subscription
 * site that looks like the paywall breaking.
 *
 * The matcher is the important part for performance. Middleware runs before
 * the CDN can serve a cached page, so matching too broadly turns a static news
 * site into a dynamic one. Static assets, images and the feeds are excluded;
 * public article pages still pass through, because they must be able to
 * recognise a signed-in subscriber.
 */
export async function middleware(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   _next/static, _next/image  — build output, never session-dependent
     *   favicon / icons / manifest — static
     *   sitemap, robots, rss feeds — anonymous by definition
     *   image and font files       — served from the CDN
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|news-sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)',
  ],
};
