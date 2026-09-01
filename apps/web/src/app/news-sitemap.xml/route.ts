import { cachedNewsSitemapEntries } from '@/lib/data';
import { SITE, articlePath } from '@/lib/site';

/**
 * Google News sitemap.
 *
 * A separate document from sitemap.xml because it uses the `news:` namespace
 * and has rules the general sitemap does not: only stories from the last 48
 * hours may appear, and Google ignores — or distrusts — a news sitemap that
 * carries older URLs.
 *
 * Hand-built XML rather than the Metadata API, which has no news namespace.
 */

export const revalidate = 600;

export async function GET(): Promise<Response> {
  const articles = await cachedNewsSitemapEntries().catch(() => []);

  const urls = articles
    .map(
      (article) => `  <url>
    <loc>${escapeXml(`${SITE.origin}${articlePath(article.slug)}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE.name)}</news:name>
        <news:language>${article.language}</news:language>
      </news:publication>
      <news:publication_date>${new Date(article.published_at).toISOString()}</news:publication_date>
      <news:title>${escapeXml(article.title_te ?? article.title)}</news:title>
    </news:news>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
    },
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
