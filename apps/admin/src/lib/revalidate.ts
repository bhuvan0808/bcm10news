import { createClient } from '@bcm10/database/server';
import { ADMIN } from './site';

/**
 * Tells the public site to drop its cached copies of a story.
 *
 * The two apps are separate deployments, so the admin cannot call
 * `revalidateTag` directly — it has to ask over HTTP, authenticated with the
 * shared REVALIDATE_SECRET.
 *
 * This never throws. A failed cache purge means the story appears up to a
 * revalidate window late; a thrown error would mean the publish itself failed
 * after the database had already committed, which is far worse and leaves the
 * newsroom unsure whether the story went out.
 */
export interface RevalidateSubject {
  slug: string;
  categorySlug?: string | null;
  secondaryCategorySlug?: string | null;
  authorSlug?: string | null;
  locationSlug?: string | null;
  tagSlugs?: string[];
  previousSlug?: string | null;
}

export async function revalidatePublicSite(
  subject: RevalidateSubject
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env['REVALIDATE_SECRET'];

  if (!secret) {
    console.warn('REVALIDATE_SECRET is not set; the public site will refresh on its own timers.');
    return { ok: false, error: 'not-configured' };
  }

  try {
    const response = await fetch(`${ADMIN.publicSiteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify(subject),
      // Bounded: a slow public site must not hold up the editor's UI.
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`Revalidation returned ${response.status}`, text.slice(0, 200));
      return { ok: false, error: `http-${response.status}` };
    }

    return { ok: true };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'unknown';
    console.error('Revalidation request failed', message);
    return { ok: false, error: message };
  }
}

/**
 * Gathers everything the cache purge needs for one article.
 *
 * Done as one read so the caller does not have to assemble slugs by hand and
 * accidentally omit, say, the author page — which would leave a reporter's
 * archive stale after every publish.
 */
export async function buildRevalidateSubject(
  articleId: string,
  previousSlug?: string | null
): Promise<RevalidateSubject | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('articles')
    .select(
      `slug,
       category:categories!articles_category_id_fkey(slug),
       secondary_category:categories!articles_secondary_category_id_fkey(slug),
       location:locations!articles_location_id_fkey(slug),
       author:profiles!articles_author_id_fkey(slug),
       article_tags(tag:tags(slug))`
    )
    .eq('id', articleId)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    slug: string;
    category: { slug: string } | null;
    secondary_category: { slug: string } | null;
    location: { slug: string } | null;
    author: { slug: string | null } | null;
    article_tags: { tag: { slug: string } | null }[] | null;
  };

  return {
    slug: row.slug,
    categorySlug: row.category?.slug ?? null,
    secondaryCategorySlug: row.secondary_category?.slug ?? null,
    locationSlug: row.location?.slug ?? null,
    authorSlug: row.author?.slug ?? null,
    tagSlugs: (row.article_tags ?? [])
      .map((entry) => entry.tag?.slug)
      .filter((slug): slug is string => Boolean(slug)),
    previousSlug: previousSlug ?? null,
  };
}
