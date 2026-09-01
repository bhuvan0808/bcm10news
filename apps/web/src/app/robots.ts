import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * robots.txt
 *
 * Search and account routes are disallowed: search-results pages are thin
 * content, and /account is per-reader and uncacheable, so crawling it wastes
 * budget that should go to stories.
 *
 * Preview and staging deployments block everything. A preview origin indexed
 * alongside production splits ranking signals and can outrank the real site
 * for its own headlines.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env['VERCEL_ENV'] === 'production' || process.env['NODE_ENV'] === 'production';

  if (!isProduction) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/account', '/search', '/newsletter/'],
      },
      // News crawlers get the article tree explicitly.
      { userAgent: 'Googlebot-News', allow: '/news/' },
    ],
    sitemap: [`${SITE.origin}/sitemap.xml`, `${SITE.origin}/news-sitemap.xml`],
    host: SITE.origin,
  };
}
