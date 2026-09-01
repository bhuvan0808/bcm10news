import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArticleQueryInput } from '@bcm10/validation';
import type {
  ArticleRevisionRow,
  ArticleStatus,
  ArticleStatusHistoryRow,
  Database,
  EditorReviewRow,
  ProfileRow,
} from '../generated/database.types';
import type { Paginated } from './types';

type Client = SupabaseClient<Database>;

/** Columns the newsroom list view needs. Bodies are never fetched for a list. */
const NEWSROOM_LIST_SELECT = `
  id, slug, title, title_te, status, is_breaking, is_premium, is_featured,
  published_at, scheduled_for, created_at, updated_at,
  author_id, editor_id, category_id, reading_time_minutes, word_count, view_count,
  category:categories!articles_category_id_fkey(id, slug, name, name_te),
  featured_image:media!articles_featured_image_id_fkey(id, storage_key, alt_text, width, height, blur_data_url)
`;

export interface NewsroomArticle {
  id: string;
  slug: string;
  title: string;
  title_te: string | null;
  status: ArticleStatus;
  is_breaking: boolean;
  is_premium: boolean;
  is_featured: boolean;
  published_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  editor_id: string | null;
  category_id: string;
  reading_time_minutes: number;
  word_count: number;
  view_count: number;
  category: { id: string; slug: string; name: string; name_te: string | null } | null;
  featured_image: {
    id: string;
    storage_key: string;
    alt_text: string | null;
    width: number | null;
    height: number | null;
    blur_data_url: string | null;
  } | null;
  author?: { id: string; name: string } | null;
}

/**
 * The newsroom article list.
 *
 * RLS decides what a caller can see, so this same function powers a reporter's
 * "my drafts" and an editor's full queue — the filters narrow, they do not
 * grant. A reporter passing someone else's authorId simply gets nothing.
 */
export async function listNewsroomArticles(
  client: Client,
  input: Partial<ArticleQueryInput> = {}
): Promise<Paginated<NewsroomArticle>> {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 25;
  const offset = (page - 1) * perPage;

  let query = client.from('articles').select(NEWSROOM_LIST_SELECT, { count: 'exact' });

  if (input.status?.length) query = query.in('status', input.status);
  if (input.authorId) query = query.eq('author_id', input.authorId);
  if (input.editorId) query = query.eq('editor_id', input.editorId);
  if (input.categoryId) query = query.eq('category_id', input.categoryId);
  if (input.locationId) query = query.eq('location_id', input.locationId);
  if (input.isBreaking !== undefined) query = query.eq('is_breaking', input.isBreaking);
  if (input.isPremium !== undefined) query = query.eq('is_premium', input.isPremium);
  if (input.from) query = query.gte('created_at', input.from.toISOString());
  if (input.to) query = query.lte('created_at', input.to.toISOString());
  if (input.search) {
    const escaped = input.search.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`title.ilike.%${escaped}%,title_te.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  switch (input.sort ?? 'updated_desc') {
    case 'published_desc':
      query = query.order('published_at', { ascending: false, nullsFirst: false });
      break;
    case 'created_desc':
      query = query.order('created_at', { ascending: false });
      break;
    case 'title_asc':
      query = query.order('title', { ascending: true });
      break;
    default:
      query = query.order('updated_at', { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + perPage - 1);
  if (error) throw error;

  const items = (data ?? []) as unknown as NewsroomArticle[];
  const total = count ?? 0;

  return { items: await attachAuthors(client, items), total, page, perPage, hasMore: offset + perPage < total };
}

/** Bylines for a page of results, in one query rather than N. */
async function attachAuthors(client: Client, items: NewsroomArticle[]): Promise<NewsroomArticle[]> {
  const ids = [...new Set(items.map((item) => item.author_id))];
  if (!ids.length) return items;

  const { data } = await client.from('profiles').select('id, full_name, display_name').in('id', ids);
  const byId = new Map(
    (data ?? []).map((row) => [row.id, { id: row.id, name: row.display_name || row.full_name }])
  );

  return items.map((item) => ({ ...item, author: byId.get(item.author_id) ?? null }));
}

/** Full row for the editor, body included. RLS decides whether it is returned. */
export async function getNewsroomArticle(client: Client, id: string) {
  const { data, error } = await client
    .from('articles')
    .select(
      `*,
       category:categories!articles_category_id_fkey(id, slug, name, name_te),
       location:locations!articles_location_id_fkey(id, slug, name, name_te),
       featured_image:media!articles_featured_image_id_fkey(*),
       videos:article_videos(*),
       gallery:article_media(id, role, position, caption, media(*)),
       article_tags(tag:tags(id, slug, name, name_te)),
       article_coauthors(profile_id),
       article_related(related_article_id, position)`
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface NewsroomCounts {
  myDrafts: number;
  mySubmitted: number;
  changesRequested: number;
  reviewQueue: number;
  scheduled: number;
  publishedToday: number;
}

/**
 * Dashboard tiles. Six HEAD requests with exact counts — no rows cross the
 * wire, and each one lands on a partial index.
 *
 * The review-queue and scheduled counts are unfiltered by author on purpose:
 * RLS already returns zero to a reporter, so the same call serves both the
 * reporter dashboard and the editor desk.
 */
export async function getNewsroomCounts(client: Client, profileId: string): Promise<NewsroomCounts> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const head = () => client.from('articles').select('id', { count: 'exact', head: true });

  const [myDrafts, mySubmitted, changesRequested, reviewQueue, scheduled, publishedToday] =
    await Promise.all([
      head().eq('author_id', profileId).eq('status', 'draft'),
      head().eq('author_id', profileId).in('status', ['submitted', 'in_review']),
      head().eq('author_id', profileId).eq('status', 'changes_requested'),
      head().in('status', ['submitted', 'in_review']),
      head().eq('status', 'scheduled'),
      head().eq('status', 'published').gte('published_at', startOfToday.toISOString()),
    ]);

  return {
    myDrafts: myDrafts.count ?? 0,
    mySubmitted: mySubmitted.count ?? 0,
    changesRequested: changesRequested.count ?? 0,
    reviewQueue: reviewQueue.count ?? 0,
    scheduled: scheduled.count ?? 0,
    publishedToday: publishedToday.count ?? 0,
  };
}

export async function getArticleRevisions(
  client: Client,
  articleId: string,
  limit = 50
): Promise<ArticleRevisionRow[]> {
  const { data, error } = await client
    .from('article_revisions')
    .select('*')
    .eq('article_id', articleId)
    .order('version', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ArticleRevisionRow[];
}

export async function getArticleTimeline(
  client: Client,
  articleId: string
): Promise<{ history: ArticleStatusHistoryRow[]; reviews: EditorReviewRow[] }> {
  const [history, reviews] = await Promise.all([
    client
      .from('article_status_history')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false }),
    client
      .from('editor_reviews')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false }),
  ]);

  return {
    history: (history.data ?? []) as ArticleStatusHistoryRow[],
    reviews: (reviews.data ?? []) as EditorReviewRow[],
  };
}

export async function getCurrentProfile(client: Client): Promise<ProfileRow | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function getUnreadNotifications(client: Client, limit = 20) {
  const { data } = await client
    .from('notifications')
    .select('*')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
