/**
 * Cache-tag vocabulary.
 *
 * Publishing one story must not rebuild the site, and it must not leave a
 * stale homepage either. Every cached read is tagged from this file, and the
 * publish pipeline invalidates exactly the tags that story touches.
 *
 * Both sides — the reader that tags a cache entry and the writer that
 * invalidates it — import these helpers, so a typo cannot silently produce a
 * page that never refreshes.
 */

export const CacheTags = {
  /** Every article-derived cache entry. The blunt instrument; use sparingly. */
  articles: 'articles',
  article: (slug: string) => `article:${slug}`,
  category: (slug: string) => `category:${slug}`,
  author: (slug: string) => `author:${slug}`,
  tag: (slug: string) => `tag:${slug}`,
  location: (slug: string) => `location:${slug}`,

  homepage: 'homepage',
  navigation: 'navigation',
  settings: 'settings',
  trending: 'trending',
  sitemap: 'sitemap',
  feeds: 'feeds',
  search: 'search',
} as const;

export interface ArticleCacheSubject {
  slug: string;
  categorySlug: string | null;
  secondaryCategorySlug?: string | null;
  authorSlug?: string | null;
  locationSlug?: string | null;
  tagSlugs?: string[];
  /** Previous slug, when the story was renamed — its cached page must go too. */
  previousSlug?: string | null;
}

/**
 * Every tag that a change to one story invalidates.
 *
 * Deliberately includes the homepage, the sitemap and the feeds: a published
 * story that never appears on the front page is the failure mode this list
 * exists to prevent.
 */
export function tagsForArticle(subject: ArticleCacheSubject): string[] {
  const tags = new Set<string>([
    CacheTags.articles,
    CacheTags.article(subject.slug),
    CacheTags.homepage,
    CacheTags.sitemap,
    CacheTags.feeds,
    CacheTags.search,
  ]);

  if (subject.previousSlug && subject.previousSlug !== subject.slug) {
    tags.add(CacheTags.article(subject.previousSlug));
  }
  if (subject.categorySlug) tags.add(CacheTags.category(subject.categorySlug));
  if (subject.secondaryCategorySlug) tags.add(CacheTags.category(subject.secondaryCategorySlug));
  if (subject.authorSlug) tags.add(CacheTags.author(subject.authorSlug));
  if (subject.locationSlug) tags.add(CacheTags.location(subject.locationSlug));
  for (const tag of subject.tagSlugs ?? []) tags.add(CacheTags.tag(tag));

  return [...tags];
}

/** Paths worth revalidating alongside the tags, for anything not tag-cached. */
export function pathsForArticle(subject: ArticleCacheSubject): string[] {
  const paths = new Set<string>(['/', `/news/${subject.slug}`]);
  if (subject.categorySlug) paths.add(`/${subject.categorySlug}`);
  if (subject.previousSlug) paths.add(`/news/${subject.previousSlug}`);
  return [...paths];
}

/**
 * Revalidation windows, in seconds.
 *
 * These are the safety net, not the mechanism: correctness comes from
 * on-demand invalidation at publish time. The timers only bound how long a
 * page can be wrong if an invalidation is ever missed, so the values follow
 * how quickly each surface actually changes.
 */
export const Revalidate = {
  /** The front page changes constantly; a minute of staleness is invisible. */
  homepage: 60,
  category: 120,
  /** A published story is immutable until edited, and editing invalidates it. */
  article: 3600,
  author: 600,
  tag: 600,
  navigation: 3600,
  settings: 3600,
  sitemap: 1800,
  feeds: 900,
  trending: 300,
} as const;
