import { cachedLatest } from '@/lib/data';
import { FEED_HEADERS, renderRssFeed } from '@/lib/feed';
import { SITE } from '@/lib/site';

/**
 * Site-wide RSS feed.
 *
 * Still worth shipping in 2026: aggregators, WhatsApp/Telegram bots and
 * partner newsrooms all consume RSS, and for a regional paper that syndicates
 * content it is the cheapest distribution channel there is.
 */
export const revalidate = 900;

export async function GET(): Promise<Response> {
  const articles = await cachedLatest(50, 0).catch(() => []);

  const xml = renderRssFeed({
    title: `${SITE.name} — Latest news`,
    description: 'Breaking news and reporting from Andhra Pradesh and Telangana.',
    path: '/rss.xml',
    articles,
  });

  return new Response(xml, { headers: FEED_HEADERS });
}
