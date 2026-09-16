import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CategoryRow,
  Database,
  LocationRow,
  SiteSettingsRow,
  TagRow,
} from '../generated/database.types';

type Client = SupabaseClient<Database>;

export interface NavCategory {
  id: string;
  slug: string;
  name: string;
  name_te: string | null;
  color: string | null;
  children: NavCategory[];
}

/** Nav tree. One query, assembled in memory — the tree is at most two deep. */
export async function getNavigation(client: Client): Promise<NavCategory[]> {
  const { data, error } = await client
    .from('categories')
    .select('id, slug, name, name_te, color, parent_id, position')
    .eq('is_active', true)
    .eq('show_in_nav', true)
    .order('position');

  if (error) throw error;

  const rows = data ?? [];
  const byId = new Map<string, NavCategory>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        slug: row.slug,
        name: row.name,
        name_te: row.name_te,
        color: row.color,
        children: [],
      },
    ])
  );

  const roots: NavCategory[] = [];
  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export async function getCategoryBySlug(client: Client, slug: string): Promise<CategoryRow | null> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  // Throw rather than report a failed query as "no such category". The caller
  // turns null into notFound(), so swallowing the error makes a database
  // outage return 404 for every real section on the site — and a 404 is the
  // one status Google acts on destructively, de-indexing the URL instead of
  // retrying it. A 500 is recoverable; a de-indexed section is not.
  if (error) throw error;
  return (data as CategoryRow | null) ?? null;
}

export async function getAllCategories(client: Client): Promise<CategoryRow[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('position');
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function getLocationBySlug(client: Client, slug: string): Promise<LocationRow | null> {
  const { data, error } = await client.from('locations').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error; // See getCategoryBySlug.
  return (data as LocationRow | null) ?? null;
}

export async function getFeaturedTags(client: Client, limit = 20): Promise<TagRow[]> {
  const { data, error } = await client
    .from('tags')
    .select('*')
    .order('usage_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TagRow[];
}

export async function getTagBySlug(client: Client, slug: string): Promise<TagRow | null> {
  const { data, error } = await client.from('tags').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error; // See getCategoryBySlug.
  return (data as TagRow | null) ?? null;
}

/**
 * Site settings. Always exactly one row — the table has a singleton CHECK —
 * so a missing row means the migration has not run, and callers should treat
 * defaults as the answer rather than crashing the homepage.
 */
export async function getSiteSettings(client: Client): Promise<SiteSettingsRow | null> {
  const { data } = await client.from('site_settings').select('*').limit(1).maybeSingle();
  return (data as SiteSettingsRow | null) ?? null;
}
