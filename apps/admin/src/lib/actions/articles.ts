'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@bcm10/database/server';
import type { Json, TablesUpdate } from '@bcm10/database';
import {
  articleAutosaveInput,
  articleDraftInput,
  articlePublishInput,
  articleReviewInput,
  articleSubmitInput,
  articleSlug,
  collectMediaIds,
  deriveExcerpt,
  disambiguateSlug,
  parseYouTubeUrl,
  type ArticleDraftInput,
  type ContentDoc,
} from '@bcm10/validation';
import { requireEditorial, requireNewsroomUser } from '@/lib/auth';
import { buildRevalidateSubject, revalidatePublicSite } from '@/lib/revalidate';

/**
 * Article workflow server actions.
 *
 * Every action re-authenticates. A server action is an HTTP endpoint with a
 * generated name — treating it as "internal because only my UI calls it" is
 * how authorization holes appear.
 *
 * Note what these actions do *not* do: none of them decides whether the caller
 * may perform the transition. That is the database's job — the transition
 * trigger rejects an illegal move and the publish trigger rejects a reporter
 * without the grant. These actions shape the data and report the outcome.
 */

export interface ActionResult<T = void> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

function fail(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

/**
 * Postgres errors, translated for a newsroom rather than a DBA.
 *
 * A reporter who sees "new row violates row-level security policy" learns
 * nothing. They need to know they cannot publish directly and should submit
 * instead.
 */
function explain(error: { code?: string; message: string }): string {
  const message = error.message.toLowerCase();

  if (message.includes('publishing requires the can_publish grant')) {
    return 'You do not have permission to publish directly. Submit the story for review instead.';
  }
  if (message.includes('illegal article transition')) {
    return 'That is not a valid next step for this story. Refresh the page and try again.';
  }
  if (message.includes('duplicate key') && message.includes('slug')) {
    return 'A story already uses that URL. Change the slug and try again.';
  }
  if (error.code === '42501' || message.includes('row-level security')) {
    return 'You do not have permission to change this story.';
  }
  if (message.includes('scheduled articles require')) {
    return 'Pick a publish time before scheduling.';
  }

  console.error('Unhandled database error', error);
  return 'Something went wrong saving the story. Please try again.';
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

export async function createArticle(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireNewsroomUser();

  const parsed = articleDraftInput.safeParse(input);
  if (!parsed.success) {
    return fail('Check the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const draft = parsed.data;

  const slug = await uniqueSlug(supabase, draft.slug ?? articleSlug(draft));

  const { data, error } = await supabase
    .from('articles')
    .insert({
      slug,
      title: draft.title,
      title_te: draft.titleTe ?? null,
      subtitle: draft.subtitle ?? null,
      excerpt: draft.excerpt ?? deriveExcerpt(draft.body as ContentDoc),
      language: draft.language,
      body: draft.body as never,
      author_id: session.profile.id,
      category_id: draft.categoryId,
      secondary_category_id: draft.secondaryCategoryId ?? null,
      location_id: draft.locationId ?? null,
      status: 'draft',
      is_breaking: draft.isBreaking,
      is_exclusive: draft.isExclusive,
      is_premium: draft.isPremium,
      is_featured: draft.isFeatured,
      is_sponsored: draft.isSponsored,
      allow_comments: draft.allowComments,
      allow_syndication: draft.allowSyndication,
      preview_paragraphs: draft.previewParagraphs,
      priority: draft.priority,
      featured_image_id: draft.featuredImageId ?? null,
      og_image_id: draft.ogImageId ?? null,
      seo_title: draft.seoTitle ?? null,
      seo_description: draft.seoDescription ?? null,
      canonical_url: draft.canonicalUrl ?? null,
      noindex: draft.noindex,
      byline_override: draft.bylineOverride ?? null,
    })
    .select('id')
    .single();

  if (error) return fail(explain(error));

  await syncRelations(supabase, data.id, draft);

  redirect(`/articles/${data.id}`);
}

// -----------------------------------------------------------------------------
// Save (autosave and explicit save)
// -----------------------------------------------------------------------------

export async function saveArticle(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  await requireNewsroomUser();

  const parsed = articleAutosaveInput.safeParse(input);
  if (!parsed.success) {
    return fail('Check the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { id, changeSummary: _summary, ...draft } = parsed.data;

  // Only send columns the caller actually supplied. A partial autosave must
  // not blank out a field the reporter never touched.
  // Typed as the table's Update shape so a mistyped column name is a compile
  // error rather than a silently ignored field.
  const patch: TablesUpdate<'articles'> = {};
  const set = <K extends keyof TablesUpdate<'articles'>>(
    column: K,
    value: TablesUpdate<'articles'>[K] | undefined
  ) => {
    if (value !== undefined) patch[column] = value;
  };

  set('title', draft.title);
  set('title_te', draft.titleTe ?? null);
  set('subtitle', draft.subtitle ?? null);
  set('excerpt', draft.excerpt ?? null);
  set('language', draft.language);
  // ContentDoc is JSON by construction — zod has already validated the tree —
  // but its interface has no index signature, so TypeScript will not widen it
  // to Json on its own.
  set('body', draft.body as unknown as Json);
  set('category_id', draft.categoryId);
  set('secondary_category_id', draft.secondaryCategoryId ?? null);
  set('location_id', draft.locationId ?? null);
  set('is_breaking', draft.isBreaking);
  set('is_exclusive', draft.isExclusive);
  set('is_premium', draft.isPremium);
  set('is_featured', draft.isFeatured);
  set('is_sponsored', draft.isSponsored);
  set('allow_comments', draft.allowComments);
  set('allow_syndication', draft.allowSyndication);
  set('preview_paragraphs', draft.previewParagraphs);
  set('priority', draft.priority);
  set('featured_image_id', draft.featuredImageId ?? null);
  set('og_image_id', draft.ogImageId ?? null);
  set('seo_title', draft.seoTitle ?? null);
  set('seo_description', draft.seoDescription ?? null);
  set('canonical_url', draft.canonicalUrl ?? null);
  set('noindex', draft.noindex);
  set('byline_override', draft.bylineOverride ?? null);

  let previousSlug: string | null = null;
  if (draft.slug) {
    const { data: current } = await supabase.from('articles').select('slug').eq('id', id).maybeSingle();
    if (current && current.slug !== draft.slug) {
      previousSlug = current.slug;
      patch['slug'] = await uniqueSlug(supabase, draft.slug, id);
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, data: { savedAt: new Date().toISOString() } };
  }

  const { error } = await supabase.from('articles').update(patch).eq('id', id);
  if (error) return fail(explain(error));

  await syncRelations(supabase, id, draft);

  // A published story that gets edited must refresh on the public site
  // immediately — this is the "we corrected the headline" path.
  const { data: status } = await supabase.from('articles').select('status').eq('id', id).maybeSingle();
  if (status?.status === 'published') {
    const subject = await buildRevalidateSubject(id, previousSlug);
    if (subject) await revalidatePublicSite(subject);
  }

  revalidatePath(`/articles/${id}`);
  return { ok: true, data: { savedAt: new Date().toISOString() } };
}

// -----------------------------------------------------------------------------
// Workflow transitions
// -----------------------------------------------------------------------------

export async function submitArticle(input: unknown): Promise<ActionResult> {
  await requireNewsroomUser();

  const parsed = articleSubmitInput.safeParse(input);
  if (!parsed.success) return fail('Could not submit this story.');

  const supabase = await createClient();

  const { error } = await supabase.rpc('submit_article', {
    p_article_id: parsed.data.id,
    p_note: parsed.data.note ?? null,
  });

  if (error) return fail(explain(error));

  revalidatePath(`/articles/${parsed.data.id}`);
  revalidatePath('/articles');
  return { ok: true, message: 'Sent to the desk for review.' };
}

export async function reviewArticle(input: unknown): Promise<ActionResult> {
  await requireEditorial();

  const parsed = articleReviewInput.safeParse(input);
  if (!parsed.success) return fail('Could not record that review.');

  const supabase = await createClient();

  const { error } = await supabase.rpc('review_article', {
    p_article_id: parsed.data.id,
    p_action: parsed.data.action,
    p_comment: parsed.data.comment ?? null,
  });

  if (error) return fail(explain(error));

  revalidatePath(`/articles/${parsed.data.id}`);
  revalidatePath('/review');
  return { ok: true, message: 'Review recorded.' };
}

/**
 * Publish, or schedule.
 *
 * Ordering matters: the database transition commits first, then the cache is
 * purged, then notifications go out. If a notification provider is down the
 * story is still published — a failed push must never roll back the news.
 */
export async function publishArticle(input: unknown): Promise<ActionResult<{ status: string }>> {
  const session = await requireNewsroomUser();

  const parsed = articlePublishInput.safeParse(input);
  if (!parsed.success) {
    return fail('Check the publish options.', parsed.error.flatten().fieldErrors);
  }

  if (!session.canPublish) {
    return fail('You do not have permission to publish. Submit the story for review instead.');
  }

  const supabase = await createClient();
  const { id, scheduledFor } = parsed.data;

  const { data: status, error } = await supabase.rpc('publish_article', {
    p_article_id: id,
    p_scheduled_for: scheduledFor ? scheduledFor.toISOString() : null,
  });

  if (error) return fail(explain(error));

  // A scheduled story is not live yet, so there is nothing to purge and
  // nothing to announce. The cron job handles both when its time arrives.
  if (status === 'published') {
    const subject = await buildRevalidateSubject(id);
    if (subject) await revalidatePublicSite(subject);
  }

  revalidatePath(`/articles/${id}`);
  revalidatePath('/articles');

  return {
    ok: true,
    message: status === 'scheduled' ? 'Scheduled.' : 'Published.',
    data: { status: status as string },
  };
}

export async function unpublishArticle(id: string): Promise<ActionResult> {
  await requireEditorial();

  const supabase = await createClient();

  const { data: current } = await supabase.from('articles').select('slug').eq('id', id).maybeSingle();

  const { error } = await supabase.from('articles').update({ status: 'draft' }).eq('id', id);
  if (error) return fail(explain(error));

  // Purge with the slug captured before the change, or the now-404 page stays
  // in the CDN.
  if (current?.slug) {
    await revalidatePublicSite({ slug: current.slug });
  }

  revalidatePath(`/articles/${id}`);
  return { ok: true, message: 'Taken down and returned to draft.' };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Finds a free slug.
 *
 * The UNIQUE constraint is the real arbiter — this only avoids the common
 * collision so the reporter is not shown a database error for a duplicate
 * headline, which happens constantly with stories like "Heavy rain in
 * Hyderabad".
 */
async function uniqueSlug(supabase: Client, base: string, excludeId?: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = disambiguateSlug(base, attempt);

    let query = supabase.from('articles').select('id').eq('slug', candidate).limit(1);
    if (excludeId) query = query.neq('id', excludeId);

    const { data } = await query;
    if (!data?.length) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Reconciles tags, videos, gallery images, co-authors and related stories.
 *
 * Delete-then-insert rather than a diff: these sets are small (a story has
 * under twenty tags), and a diff would need ordering logic for marginal gain.
 * Each block is skipped entirely when the caller did not supply that field,
 * so an autosave of the body alone does not wipe the tags.
 */
async function syncRelations(
  supabase: Client,
  articleId: string,
  draft: Partial<ArticleDraftInput>
): Promise<void> {
  if (draft.tagNames) {
    const tagIds = await ensureTags(supabase, draft.tagNames);
    await supabase.from('article_tags').delete().eq('article_id', articleId);
    if (tagIds.length) {
      await supabase
        .from('article_tags')
        .insert(tagIds.map((tagId, index) => ({ article_id: articleId, tag_id: tagId, position: index })));
    }
  }

  if (draft.videoUrls) {
    await supabase.from('article_videos').delete().eq('article_id', articleId);

    const videos = draft.videoUrls
      .map((parsed, index) => {
        // The schema already parsed these, but a direct action call could
        // supply a raw string; re-parse rather than trust the shape.
        const video = typeof parsed === 'string' ? parseYouTubeUrl(parsed) : parsed;
        if (!video) return null;
        return {
          article_id: articleId,
          provider: 'youtube' as const,
          video_id: video.videoId,
          original_url: video.canonicalUrl,
          is_short: video.isShort,
          position: index,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (videos.length) await supabase.from('article_videos').insert(videos);
  }

  if (draft.galleryMediaIds) {
    await supabase.from('article_media').delete().eq('article_id', articleId).eq('role', 'gallery');

    if (draft.galleryMediaIds.length) {
      await supabase.from('article_media').insert(
        draft.galleryMediaIds.map((mediaId, index) => ({
          article_id: articleId,
          media_id: mediaId,
          role: 'gallery',
          position: index,
        }))
      );
    }
  }

  if (draft.coauthorIds) {
    await supabase.from('article_coauthors').delete().eq('article_id', articleId);
    if (draft.coauthorIds.length) {
      await supabase.from('article_coauthors').insert(
        draft.coauthorIds.map((profileId, index) => ({
          article_id: articleId,
          profile_id: profileId,
          position: index,
        }))
      );
    }
  }

  if (draft.relatedArticleIds) {
    await supabase.from('article_related').delete().eq('article_id', articleId);
    const related = draft.relatedArticleIds.filter((relatedId) => relatedId !== articleId);
    if (related.length) {
      await supabase.from('article_related').insert(
        related.map((relatedId, index) => ({
          article_id: articleId,
          related_article_id: relatedId,
          position: index,
        }))
      );
    }
  }

  // Images embedded in the body count as usage, so the media library can show
  // a photographer where their picture ran.
  if (draft.body) {
    const bodyMediaIds = collectMediaIds(draft.body as ContentDoc);
    if (bodyMediaIds.length) {
      await supabase.from('article_media').upsert(
        bodyMediaIds.map((mediaId, index) => ({
          article_id: articleId,
          media_id: mediaId,
          role: 'inline',
          position: index,
        })),
        { onConflict: 'article_id,media_id,role', ignoreDuplicates: true }
      );
    }
  }
}

/** Resolves tag names to ids, creating any that do not exist yet. */
async function ensureTags(supabase: Client, names: string[]): Promise<string[]> {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (!cleaned.length) return [];

  const slugs = cleaned.map((name) => slugifyTag(name));

  const { data: existing } = await supabase.from('tags').select('id, slug').in('slug', slugs);
  const bySlug = new Map((existing ?? []).map((tag) => [tag.slug, tag.id]));

  const missing = cleaned.filter((_name, index) => !bySlug.has(slugs[index]!));

  if (missing.length) {
    const { data: created } = await supabase
      .from('tags')
      .insert(missing.map((name) => ({ name, slug: slugifyTag(name) })))
      .select('id, slug');

    for (const tag of created ?? []) bySlug.set(tag.slug, tag.id);
  }

  return slugs.map((slug) => bySlug.get(slug)).filter((id): id is string => Boolean(id));
}

/** Tag slugs allow Telugu, matching the `tags_slug_format` CHECK. */
function slugifyTag(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‌‍]/g, '')
    .replace(/[^a-z0-9ఀ-౿]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
