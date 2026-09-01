import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, HomepageSectionRow } from '../generated/database.types';
import {
  getArticlesByCategory,
  getFeaturedArticles,
  getLatestArticles,
  getMostReadArticles,
  getVideoArticles,
} from './articles';
import { PREVIEW_SELECT } from './selects';
import type { ArticlePreview } from './types';

type Client = SupabaseClient<Database>;

export interface HomepageSection {
  key: string;
  title: string;
  titleTe: string | null;
  layout: HomepageSectionRow['layout'];
  categorySlug: string | null;
  articles: ArticlePreview[];
}

/**
 * Builds the homepage from the configurable section list.
 *
 * Two properties matter here:
 *
 *  1. Sections are fetched in parallel. The homepage is a dozen small indexed
 *     queries, not one enormous join, so a slow section cannot stall the rest.
 *  2. Stories already used higher up are excluded from later sections, so the
 *     lead does not reappear three times as the reader scrolls.
 *
 * The caller wraps this in a cached function keyed by the `homepage` cache tag;
 * publishing invalidates that tag rather than rebuilding the whole site.
 */
export async function getHomepage(client: Client): Promise<HomepageSection[]> {
  const { data: sectionRows, error } = await client
    .from('homepage_sections')
    .select('*')
    .eq('is_active', true)
    .order('position');

  if (error) throw error;

  const sections = (sectionRows ?? []) as HomepageSectionRow[];
  if (!sections.length) return fallbackHomepage(client);

  // Resolve category ids to slugs once, rather than per section.
  const categoryIds = sections.map((s) => s.category_id).filter((id): id is string => Boolean(id));
  const categorySlugById = new Map<string, string>();

  if (categoryIds.length) {
    const { data: categories } = await client
      .from('categories')
      .select('id, slug')
      .in('id', [...new Set(categoryIds)]);
    for (const row of categories ?? []) categorySlugById.set(row.id, row.slug);
  }

  const resolved = await Promise.all(
    sections.map(async (section) => {
      const categorySlug = section.category_id
        ? (categorySlugById.get(section.category_id) ?? null)
        : null;
      const articles = await fetchSectionArticles(client, section, categorySlug);
      return {
        key: section.key,
        title: section.title,
        titleTe: section.title_te,
        layout: section.layout,
        categorySlug,
        articles,
      } satisfies HomepageSection;
    })
  );

  return dedupeAcrossSections(resolved);
}

async function fetchSectionArticles(
  client: Client,
  section: HomepageSectionRow,
  categorySlug: string | null
): Promise<ArticlePreview[]> {
  const limit = section.item_limit;

  switch (section.source) {
    case 'latest':
      return getLatestArticles(client, { limit });

    case 'category':
      return categorySlug ? getArticlesByCategory(client, categorySlug, { limit }) : [];

    case 'most_read':
      return getMostReadArticles(client, { limit });

    case 'editors_picks':
      return getFeaturedArticles(client, { limit });

    case 'videos':
      return getVideoArticles(client, { limit });

    case 'photos': {
      // Stories that carry a gallery. Approximated by requiring a featured
      // image on a story in the photos desk.
      const { data } = await client
        .from('article_previews')
        .select(PREVIEW_SELECT)
        .not('featured_image_id', 'is', null)
        .order('published_at', { ascending: false })
        .limit(limit);
      return (data ?? []) as ArticlePreview[];
    }

    case 'manual': {
      const ids = section.manual_article_ids ?? [];
      if (!ids.length) return [];
      const { data } = await client.from('article_previews').select(PREVIEW_SELECT).in('id', ids);
      const byId = new Map(
        (data ?? []).map((row) => [(row as ArticlePreview).id, row as ArticlePreview])
      );
      return ids.map((id) => byId.get(id)).filter((row): row is ArticlePreview => Boolean(row));
    }

    case 'tag': {
      if (!section.tag_id) return [];
      const { data: links } = await client
        .from('article_tags')
        .select('article_id')
        .eq('tag_id', section.tag_id)
        .limit(limit * 2);
      const ids = (links ?? []).map((row) => row.article_id);
      if (!ids.length) return [];
      const { data } = await client
        .from('article_previews')
        .select(PREVIEW_SELECT)
        .in('id', ids)
        .order('published_at', { ascending: false })
        .limit(limit);
      return (data ?? []) as ArticlePreview[];
    }

    case 'location': {
      if (!section.location_id) return [];
      const { data } = await client
        .from('article_previews')
        .select(PREVIEW_SELECT)
        .eq('location_id', section.location_id)
        .order('published_at', { ascending: false })
        .limit(limit);
      return (data ?? []) as ArticlePreview[];
    }

    default:
      return [];
  }
}

/**
 * Removes repeats as the page flows downward. The hero keeps its stories;
 * later sections give theirs up. "Most read" is exempt — a story being both
 * lead and most-read is information, not a duplication bug.
 */
function dedupeAcrossSections(sections: HomepageSection[]): HomepageSection[] {
  const seen = new Set<string>();
  const EXEMPT = new Set(['most-read', 'most_read']);

  return sections.map((section) => {
    if (EXEMPT.has(section.key)) return section;

    const articles = section.articles.filter((article) => {
      if (seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });

    return { ...section, articles };
  });
}

/** Used before any homepage_sections rows exist, so a fresh install still renders. */
async function fallbackHomepage(client: Client): Promise<HomepageSection[]> {
  const latest = await getLatestArticles(client, { limit: 20 });
  return [
    {
      key: 'hero',
      title: 'Top Stories',
      titleTe: 'ముఖ్యాంశాలు',
      layout: 'hero',
      categorySlug: null,
      articles: latest.slice(0, 5),
    },
    {
      key: 'latest',
      title: 'Latest News',
      titleTe: 'తాజా వార్తలు',
      layout: 'list',
      categorySlug: null,
      articles: latest.slice(5),
    },
  ];
}
