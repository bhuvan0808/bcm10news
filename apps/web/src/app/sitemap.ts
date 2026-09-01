import type { MetadataRoute } from 'next';
import { getAllCategories } from '@bcm10/database';
import { createPublicClient } from '@bcm10/database/server';
import { cachedSitemapEntries } from '@/lib/data';
import { SITE, articlePath, categoryPath } from '@/lib/site';

/**
 * sitemap.xml
 *
 * Static pages, every section, and published stories. `changeFrequency` and
 * `priority` are advisory at best, but the URL set and `lastModified` are what
 * a crawler actually uses, and those are accurate here because they come from
 * the article rows themselves.
 */
export const revalidate = 1800;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories] = await Promise.all([
    cachedSitemapEntries().catch(() => []),
    getAllCategories(createPublicClient()).catch(() => []),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.origin, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE.origin}/subscribe`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE.origin}/about`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE.origin}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE.origin}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE.origin}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  return [
    ...staticPages,
    ...categories.map((category) => ({
      url: `${SITE.origin}${categoryPath(category.slug)}`,
      lastModified: new Date(category.updated_at),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    })),
    ...articles.map((article) => ({
      url: `${SITE.origin}${articlePath(article.slug)}`,
      lastModified: new Date(article.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
