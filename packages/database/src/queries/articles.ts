import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../generated/database.types';
import { ARTICLE_DETAIL_SELECT, AUTHOR_SELECT, PREVIEW_SELECT } from './selects';
import type {
  ArticleDetail,
  ArticlePreview,
  ArticleResult,
  Author,
  Paginated,
  TagSummary,
} from './types';

type Client = SupabaseClient<Database>;

export interface ListOptions {
  limit?: number;
  offset?: number;
  /** Exclude specific ids — used to stop the hero repeating further down. */
  excludeIds?: string[];
}

const DEFAULT_LIMIT = 12;

function applyExclusions<T>(query: T, excludeIds?: string[]): T {
  if (!excludeIds?.length) return query;
  // PostgREST `not.in` wants a parenthesised list.
  return (query as { not: (c: string, o: string, v: string) => T }).not(
    'id',
    'in',
    `(${excludeIds.join(',')})`
  );
}

/**
 * The article page's single entry point.
 *
 * Three outcomes, distinguished without leaking which is which to an
 * unauthorised reader:
 *
 *  • full       — RLS returned the row; render the body
 *  • paywalled  — the preview exists but the row does not, so the reader is
 *                 not entitled to a premium story
 *  • not_found  — neither exists
 *
 * The preview read is what makes the paywall renderable at all: the full row
 * is genuinely invisible, so there is no body in memory to accidentally send.
 */
export async function getArticleBySlug(client: Client, slug: string): Promise<ArticleResult> {
  const [previewResult, articleResult] = await Promise.all([
    client.from('article_previews').select(PREVIEW_SELECT).eq('slug', slug).maybeSingle(),
    client
      .from('articles')
      .select(ARTICLE_DETAIL_SELECT)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle(),
  ]);

  const preview = (previewResult.data as ArticlePreview | null) ?? null;
  const article = (articleResult.data as unknown as ArticleDetail | null) ?? null;

  if (!preview && !article) {
    // The slug may have been retired. article_slug_history is world-readable
    // precisely so an old link can 301 instead of 404.
    const { data: historic } = await client
      .from('article_slug_history')
      .select('article_id')
      .eq('slug', slug)
      .maybeSingle();

    if (historic?.article_id) {
      const { data: current } = await client
        .from('article_previews')
        .select('slug')
        .eq('id', historic.article_id)
        .maybeSingle();

      if (current?.slug) {
        return {
          access: 'not_found',
          preview: null,
          article: null,
          author: null,
          coauthors: [],
          tags: [],
          redirectToSlug: current.slug,
        };
      }
    }

    return {
      access: 'not_found',
      preview: null,
      article: null,
      author: null,
      coauthors: [],
      tags: [],
      redirectToSlug: null,
    };
  }

  const authorId = article?.author_id ?? preview?.author_id ?? null;
  const [author, coauthors] = await Promise.all([
    authorId ? getAuthorById(client, authorId) : Promise.resolve(null),
    article ? getCoauthors(client, article.id) : Promise.resolve([]),
  ]);

  const tags: TagSummary[] =
    article?.article_tags?.map((row) => row.tag).filter((tag): tag is TagSummary => Boolean(tag)) ??
    [];

  return {
    access: article ? 'full' : 'paywalled',
    preview,
    article,
    author,
    coauthors,
    tags,
    redirectToSlug: null,
  };
}

async function getCoauthors(client: Client, articleId: string): Promise<Author[]> {
  const { data } = await client
    .from('article_coauthors')
    .select('profile_id, position')
    .eq('article_id', articleId)
    .order('position');

  const ids = (data ?? []).map((row) => row.profile_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: authors } = await client
    .from('author_profiles')
    .select(AUTHOR_SELECT)
    .in('id', ids);
  return (authors ?? []) as Author[];
}

export async function getAuthorById(client: Client, id: string): Promise<Author | null> {
  const { data } = await client
    .from('author_profiles')
    .select(AUTHOR_SELECT)
    .eq('id', id)
    .maybeSingle();
  return (data as Author | null) ?? null;
}

export async function getAuthorBySlug(client: Client, slug: string): Promise<Author | null> {
  const { data } = await client
    .from('author_profiles')
    .select(AUTHOR_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  return (data as Author | null) ?? null;
}

/** Newest published stories across the whole site. */
export async function getLatestArticles(
  client: Client,
  { limit = DEFAULT_LIMIT, offset = 0, excludeIds }: ListOptions = {}
): Promise<ArticlePreview[]> {
  let query = client
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyExclusions(query, excludeIds);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ArticlePreview[];
}

export async function getArticlesByCategory(
  client: Client,
  categorySlug: string,
  { limit = DEFAULT_LIMIT, offset = 0, excludeIds }: ListOptions = {}
): Promise<ArticlePreview[]> {
  let query = client
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .eq('category_slug', categorySlug)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyExclusions(query, excludeIds);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ArticlePreview[];
}

/** Paginated category listing, for /{category}?page=N. */
export async function getCategoryPage(
  client: Client,
  categorySlug: string,
  page = 1,
  perPage = 20
): Promise<Paginated<ArticlePreview>> {
  const offset = (page - 1) * perPage;

  const { data, error, count } = await client
    .from('article_previews')
    .select(PREVIEW_SELECT, { count: 'estimated' })
    .eq('category_slug', categorySlug)
    .order('published_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data ?? []) as ArticlePreview[],
    total,
    page,
    perPage,
    hasMore: offset + perPage < total,
  };
}

export async function getArticlesByAuthor(
  client: Client,
  authorId: string,
  page = 1,
  perPage = 20
): Promise<Paginated<ArticlePreview>> {
  const offset = (page - 1) * perPage;

  const { data, error, count } = await client
    .from('article_previews')
    .select(PREVIEW_SELECT, { count: 'estimated' })
    .eq('author_id', authorId)
    .order('published_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data ?? []) as ArticlePreview[],
    total,
    page,
    perPage,
    hasMore: offset + perPage < total,
  };
}

export async function getArticlesByTag(
  client: Client,
  tagSlug: string,
  page = 1,
  perPage = 20
): Promise<Paginated<ArticlePreview>> {
  const { data: tag } = await client.from('tags').select('id').eq('slug', tagSlug).maybeSingle();
  if (!tag) return { items: [], total: 0, page, perPage, hasMore: false };

  const { data: links } = await client
    .from('article_tags')
    .select('article_id')
    .eq('tag_id', tag.id)
    .limit(500);

  const ids = (links ?? []).map((row) => row.article_id);
  if (!ids.length) return { items: [], total: 0, page, perPage, hasMore: false };

  const offset = (page - 1) * perPage;
  const { data, error, count } = await client
    .from('article_previews')
    .select(PREVIEW_SELECT, { count: 'estimated' })
    .in('id', ids)
    .order('published_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data ?? []) as ArticlePreview[],
    total,
    page,
    perPage,
    hasMore: offset + perPage < total,
  };
}

/**
 * Breaking-news ticker. Bounded by a freshness window so a story that was
 * flagged breaking yesterday stops shouting today.
 */
export async function getBreakingArticles(
  client: Client,
  { limit = 6, withinMinutes = 240 }: { limit?: number; withinMinutes?: number } = {}
): Promise<ArticlePreview[]> {
  const since = new Date(Date.now() - withinMinutes * 60_000).toISOString();

  const { data, error } = await client
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .eq('is_breaking', true)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ArticlePreview[];
}

export async function getFeaturedArticles(
  client: Client,
  { limit = 5, excludeIds }: ListOptions = {}
): Promise<ArticlePreview[]> {
  let query = client
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .eq('is_featured', true)
    .order('priority', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  query = applyExclusions(query, excludeIds);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ArticlePreview[];
}

/**
 * Most read, from the trending materialized view. Falls back to the lifetime
 * view_count column when the view is empty — which it is on a fresh install,
 * before the first refresh has run.
 */
export async function getMostReadArticles(
  client: Client,
  { limit = 8 }: ListOptions = {}
): Promise<ArticlePreview[]> {
  const { data: trending } = await client
    .from('trending_articles')
    .select('article_id, views_24h')
    .order('views_24h', { ascending: false })
    .limit(limit);

  // trending_articles is a materialized view, so its columns type as nullable
  // even though the grouping key cannot be null.
  const ids = (trending ?? [])
    .map((row) => row.article_id)
    .filter((id): id is string => Boolean(id));

  if (ids.length) {
    const { data } = await client.from('article_previews').select(PREVIEW_SELECT).in('id', ids);
    const byId = new Map(
      (data ?? []).map((row) => [(row as ArticlePreview).id, row as ArticlePreview])
    );
    // Preserve the ranking order the view gave us.
    return ids.map((id) => byId.get(id)).filter((row): row is ArticlePreview => Boolean(row));
  }

  const { data } = await client
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .order('view_count', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ArticlePreview[];
}

/**
 * Related stories: editor-curated first, topped up with recent stories from
 * the same category. Editors' choices always win over the automatic fill.
 */
export async function getRelatedArticles(
  client: Client,
  articleId: string,
  categorySlug: string,
  limit = 6
): Promise<ArticlePreview[]> {
  const { data: curated } = await client
    .from('article_related')
    .select('related_article_id, position')
    .eq('article_id', articleId)
    .order('position')
    .limit(limit);

  const curatedIds = (curated ?? []).map((row) => row.related_article_id);

  let picked: ArticlePreview[] = [];
  if (curatedIds.length) {
    const { data } = await client
      .from('article_previews')
      .select(PREVIEW_SELECT)
      .in('id', curatedIds);
    const byId = new Map(
      (data ?? []).map((row) => [(row as ArticlePreview).id, row as ArticlePreview])
    );
    picked = curatedIds
      .map((id) => byId.get(id))
      .filter((row): row is ArticlePreview => Boolean(row));
  }

  if (picked.length >= limit) return picked.slice(0, limit);

  const fill = await getArticlesByCategory(client, categorySlug, {
    limit: limit - picked.length,
    excludeIds: [articleId, ...picked.map((row) => row.id)],
  });

  return [...picked, ...fill];
}

/** Stories that carry at least one video, for the /videos section. */
export async function getVideoArticles(
  client: Client,
  { limit = 8 }: ListOptions = {}
): Promise<ArticlePreview[]> {
  const { data: videoRows } = await client
    .from('article_videos')
    .select('article_id')
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  const ids = [...new Set((videoRows ?? []).map((row) => row.article_id))];
  if (!ids.length) return [];

  const { data } = await client
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .in('id', ids)
    .order('published_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ArticlePreview[];
}

export interface SitemapEntry {
  slug: string;
  title: string;
  title_te: string | null;
  updated_at: string;
  published_at: string;
  category_slug: string;
  language: 'te' | 'en';
}

/** The view guarantees these columns; see the note on ArticlePreview. */
type RawSitemapRow = {
  slug: string | null;
  title: string | null;
  title_te: string | null;
  updated_at: string | null;
  published_at: string | null;
  category_slug: string | null;
  language: 'te' | 'en' | null;
};

/**
 * Published stories for sitemap generation.
 *
 * Includes the headline because the Google News sitemap requires a
 * `news:title`, and reconstructing one from the slug produces mangled text —
 * especially for Telugu slugs, where hyphens are word separators inside a
 * script that does not use them.
 */
export async function getAllPublishedSlugs(
  client: Client,
  { since, limit = 5000 }: { since?: Date; limit?: number } = {}
): Promise<SitemapEntry[]> {
  let query = client
    .from('article_previews')
    .select('slug, title, title_te, updated_at, published_at, category_slug, language')
    .eq('noindex', false)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (since) query = query.gte('published_at', since.toISOString());

  const { data, error } = await query;
  if (error) throw error;

  return (
    ((data ?? []) as RawSitemapRow[])
      // A row missing a slug or a publish date cannot appear in a sitemap, so
      // drop it rather than emitting a broken <url> entry.
      .filter((row): row is RawSitemapRow & { slug: string; published_at: string } =>
        Boolean(row.slug && row.published_at)
      )
      .map((row) => ({
        slug: row.slug,
        title: row.title ?? row.slug,
        title_te: row.title_te,
        updated_at: row.updated_at ?? row.published_at,
        published_at: row.published_at,
        category_slug: row.category_slug ?? '',
        language: row.language ?? 'te',
      }))
  );
}
