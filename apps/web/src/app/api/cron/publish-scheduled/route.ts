import { revalidatePath, revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@bcm10/database/admin';
import { CacheTags, pathsForArticle, tagsForArticle } from '@bcm10/database';
import { authoriseInternal, json, serverError, unauthorized } from '@/lib/api';

/**
 * Publishes stories whose scheduled time has arrived.
 *
 * Runs every minute from Vercel Cron. The actual transition happens inside
 * `publish_due_articles()` in Postgres, in a single statement, so two
 * overlapping cron invocations cannot publish the same story twice — the
 * UPDATE ... RETURNING only returns rows to whichever transaction won.
 *
 * Cache invalidation happens here rather than in the database, because it is
 * the one part of publishing that lives in the CDN and not in SQL.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!authoriseInternal(request, 'CRON_SECRET')) return unauthorized();

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('publish_due_articles');

  if (error) {
    console.error('publish_due_articles failed', error.message);
    return serverError('Could not publish scheduled stories');
  }

  const published = data ?? [];

  for (const article of published) {
    const subject = {
      slug: article.slug,
      categorySlug: article.category_slug,
    };
    for (const tag of tagsForArticle(subject)) revalidateTag(tag);
    for (const path of pathsForArticle(subject)) revalidatePath(path);
  }

  if (published.length) revalidateTag(CacheTags.homepage);

  return json({
    ok: true,
    published: published.length,
    slugs: published.map((article) => article.slug),
  });
}
