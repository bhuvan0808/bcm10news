import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../generated/database.types';
import type { Paginated } from './types';

type Client = SupabaseClient<Database>;

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  title_te: string | null;
  excerpt: string | null;
  published_at: string;
  category_slug: string;
  category_name: string;
  author_name: string;
  featured_image_key: string | null;
  featured_image_alt: string | null;
  reading_time_minutes: number;
  is_premium: boolean;
  rank: number;
}

/**
 * Search.
 *
 * Delegates to the `search_articles` SQL function rather than composing
 * PostgREST filters, because ranking across a weighted tsvector plus a trigram
 * fallback is not expressible in the REST filter language. Keeping it in SQL
 * also means the query plan is stable and indexable.
 *
 * The function is the seam the spec asks for: swapping Postgres FTS for
 * Meilisearch or Typesense later means reimplementing this one function, not
 * touching the search page.
 */
export async function searchArticles(
  client: Client,
  query: string,
  {
    categorySlug,
    page = 1,
    perPage = 20,
  }: { categorySlug?: string; page?: number; perPage?: number } = {}
): Promise<Paginated<SearchHit>> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { items: [], total: 0, page, perPage, hasMore: false };
  }

  const offset = (page - 1) * perPage;

  const { data, error } = await client.rpc('search_articles', {
    p_query: trimmed,
    p_category_slug: categorySlug ?? null,
    p_limit: perPage,
    p_offset: offset,
  });

  if (error) throw error;

  const rows = (data ?? []) as (SearchHit & { total_count: number })[];
  // Every row carries the same window-wide count; zero rows means zero matches.
  const total = rows[0]?.total_count ?? 0;

  return {
    items: rows.map(({ total_count: _total, ...hit }) => hit),
    total,
    page,
    perPage,
    hasMore: offset + rows.length < total,
  };
}
