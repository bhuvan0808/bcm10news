import { notFound } from 'next/navigation';
import { cachedCategory, cachedCategoryArticles } from '@/lib/data';
import { FEED_HEADERS, renderRssFeed } from '@/lib/feed';
import { SITE, categoryPath } from '@/lib/site';

/**
 * Per-section RSS.
 *
 * Lets a partner or a reader subscribe to just Sports or just Telangana
 * instead of the firehose — which is what makes syndication practical.
 */
export const revalidate = 900;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ category: string }> }
): Promise<Response> {
  const { category: slug } = await params;

  const category = await cachedCategory(slug);
  if (!category) notFound();

  const articles = await cachedCategoryArticles(slug, 50).catch(() => []);

  const xml = renderRssFeed({
    title: `${SITE.name} — ${category.name}`,
    description: category.description ?? `${category.name} coverage from ${SITE.name}.`,
    path: `${categoryPath(slug)}/rss.xml`,
    articles,
  });

  return new Response(xml, { headers: FEED_HEADERS });
}
