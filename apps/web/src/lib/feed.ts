import type { ArticlePreview } from '@bcm10/database';
import { imageUrl, parseVariants } from '@bcm10/storage';
import { SITE, absoluteUrl, articlePath } from './site';

/**
 * RSS 2.0 generation.
 *
 * Hand-built rather than pulled from a library: the document is thirty lines,
 * and the parts that actually matter — correct escaping, a stable GUID, and an
 * enclosure that aggregators will render — are things worth being explicit
 * about.
 *
 * The GUID is the canonical URL with `isPermaLink="true"`. Aggregators
 * deduplicate on it, so it must not change when a headline is edited.
 */

export interface FeedOptions {
  title: string;
  description: string;
  path: string;
  articles: ArticlePreview[];
}

export function renderRssFeed({ title, description, path, articles }: FeedOptions): string {
  const self = absoluteUrl(path);
  const latest = articles[0]?.published_at;

  const items = articles.map((article) => renderItem(article)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(title)}</title>
  <link>${escapeXml(SITE.origin)}</link>
  <description>${escapeXml(description)}</description>
  <language>te-in</language>
  <copyright>© ${new Date().getFullYear()} ${escapeXml(SITE.name)}</copyright>
  <lastBuildDate>${new Date(latest ?? Date.now()).toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
}

function renderItem(article: ArticlePreview): string {
  const url = absoluteUrl(articlePath(article.slug));
  const description = article.excerpt ?? article.subtitle ?? '';

  const image = article.featured_image_key
    ? imageUrl(
        {
          baseUrl: SITE.mediaBaseUrl,
          storageKey: article.featured_image_key,
          variants: parseVariants(article.featured_image_variants),
          cloudflareResizing: SITE.cloudflareResizing,
        },
        1200
      )
    : null;

  return `  <item>
    <title>${escapeXml(article.title_te ?? article.title)}</title>
    <link>${escapeXml(url)}</link>
    <guid isPermaLink="true">${escapeXml(url)}</guid>
    <pubDate>${new Date(article.published_at).toUTCString()}</pubDate>
    <dc:creator>${escapeXml(article.byline_override ?? article.author_name)}</dc:creator>
    <category>${escapeXml(article.category_name)}</category>
    <description>${escapeXml(description)}</description>${
      image
        ? `
    <enclosure url="${escapeXml(image)}" type="image/jpeg" length="0" />
    <media:thumbnail url="${escapeXml(image)}" />`
        : ''
    }
  </item>`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Strip control characters that are illegal in XML 1.0 and make
    // strict aggregator parsers reject the whole document.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

export const FEED_HEADERS = {
  'Content-Type': 'application/rss+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=600, s-maxage=900, stale-while-revalidate=3600',
} as const;
