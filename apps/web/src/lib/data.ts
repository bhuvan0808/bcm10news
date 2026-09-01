import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@bcm10/database/server';
import {
  CacheTags,
  Revalidate,
  getAllPublishedSlugs,
  getArticleBySlug,
  getArticlesByAuthor,
  getArticlesByCategory,
  getArticlesByTag,
  getAuthorBySlug,
  getBreakingArticles,
  getCategoryPage,
  getFeaturedTags,
  getHomepage,
  getLatestArticles,
  getMostReadArticles,
  getNavigation,
  getRelatedArticles,
  getSiteSettings,
  getCategoryBySlug,
  getTagBySlug,
  searchArticles,
} from '@bcm10/database';

/**
 * Cached read layer for the public site.
 *
 * Every function here uses the *anonymous* client — no session, no cookies.
 * That is what makes the result shareable: a page rendered for one visitor is
 * correct for the next, which is the precondition for caching a news site at
 * all.
 *
 * Anything reader-specific (a paywalled body, saved articles, the account
 * page) must not come through this module; it uses the session client and
 * renders dynamically.
 *
 * Each entry carries cache tags from the shared vocabulary, and the publish
 * pipeline invalidates those exact tags. The `revalidate` values are a safety
 * net for a missed invalidation, not the mechanism.
 */

const client = () => createPublicClient();

export const cachedNavigation = unstable_cache(
  async () => getNavigation(client()),
  ['navigation'],
  { tags: [CacheTags.navigation], revalidate: Revalidate.navigation }
);

export const cachedSiteSettings = unstable_cache(
  async () => getSiteSettings(client()),
  ['site-settings'],
  { tags: [CacheTags.settings], revalidate: Revalidate.settings }
);

export const cachedHomepage = unstable_cache(async () => getHomepage(client()), ['homepage'], {
  tags: [CacheTags.homepage, CacheTags.articles],
  revalidate: Revalidate.homepage,
});

export const cachedBreaking = unstable_cache(
  async (withinMinutes: number) => getBreakingArticles(client(), { withinMinutes }),
  ['breaking'],
  { tags: [CacheTags.articles], revalidate: 60 }
);

export const cachedMostRead = unstable_cache(
  async (limit: number) => getMostReadArticles(client(), { limit }),
  ['most-read'],
  { tags: [CacheTags.trending], revalidate: Revalidate.trending }
);

export const cachedLatest = unstable_cache(
  async (limit: number, offset: number) => getLatestArticles(client(), { limit, offset }),
  ['latest'],
  { tags: [CacheTags.articles], revalidate: Revalidate.homepage }
);

/**
 * The article read.
 *
 * Cached under the anonymous identity, so what is stored is the version a
 * signed-out reader sees. For a premium story that is the teaser — the page
 * component re-reads with the reader's own session when it needs the full
 * body, which is uncacheable by definition.
 */
export const cachedArticle = unstable_cache(
  async (slug: string) => getArticleBySlug(client(), slug),
  ['article'],
  { tags: [CacheTags.articles], revalidate: Revalidate.article }
);

export const cachedRelated = unstable_cache(
  async (articleId: string, categorySlug: string, limit: number) =>
    getRelatedArticles(client(), articleId, categorySlug, limit),
  ['related'],
  { tags: [CacheTags.articles], revalidate: Revalidate.article }
);

export const cachedCategory = unstable_cache(
  async (slug: string) => getCategoryBySlug(client(), slug),
  ['category'],
  { tags: [CacheTags.navigation], revalidate: Revalidate.navigation }
);

export const cachedCategoryPage = unstable_cache(
  async (slug: string, page: number, perPage: number) =>
    getCategoryPage(client(), slug, page, perPage),
  ['category-page'],
  { tags: [CacheTags.articles], revalidate: Revalidate.category }
);

export const cachedCategoryArticles = unstable_cache(
  async (slug: string, limit: number) => getArticlesByCategory(client(), slug, { limit }),
  ['category-articles'],
  { tags: [CacheTags.articles], revalidate: Revalidate.category }
);

export const cachedAuthor = unstable_cache(
  async (slug: string) => getAuthorBySlug(client(), slug),
  ['author'],
  { tags: [CacheTags.articles], revalidate: Revalidate.author }
);

export const cachedAuthorArticles = unstable_cache(
  async (authorId: string, page: number, perPage: number) =>
    getArticlesByAuthor(client(), authorId, page, perPage),
  ['author-articles'],
  { tags: [CacheTags.articles], revalidate: Revalidate.author }
);

export const cachedTag = unstable_cache(async (slug: string) => getTagBySlug(client(), slug), ['tag'], {
  tags: [CacheTags.articles],
  revalidate: Revalidate.tag,
});

export const cachedTagArticles = unstable_cache(
  async (slug: string, page: number, perPage: number) => getArticlesByTag(client(), slug, page, perPage),
  ['tag-articles'],
  { tags: [CacheTags.articles], revalidate: Revalidate.tag }
);

export const cachedFeaturedTags = unstable_cache(
  async (limit: number) => getFeaturedTags(client(), limit),
  ['featured-tags'],
  { tags: [CacheTags.articles], revalidate: Revalidate.tag }
);

export const cachedSitemapEntries = unstable_cache(
  async () => getAllPublishedSlugs(client()),
  ['sitemap-entries'],
  { tags: [CacheTags.sitemap], revalidate: Revalidate.sitemap }
);

/** Recent stories for the Google News sitemap, which only accepts 48 hours. */
export const cachedNewsSitemapEntries = unstable_cache(
  async () => getAllPublishedSlugs(client(), { since: new Date(Date.now() - 48 * 3600 * 1000), limit: 1000 }),
  ['news-sitemap-entries'],
  { tags: [CacheTags.sitemap], revalidate: 600 }
);

/**
 * Search is NOT cached per query — the key space is unbounded and a news
 * archive is queried with long-tail terms. It runs against the anonymous
 * client so results never reflect one reader's entitlements.
 */
export async function runSearch(query: string, options: { category?: string; page?: number }) {
  return searchArticles(client(), query, {
    categorySlug: options.category,
    page: options.page ?? 1,
  });
}
