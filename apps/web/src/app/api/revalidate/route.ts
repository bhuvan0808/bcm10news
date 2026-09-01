import { revalidatePath, revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { pathsForArticle, tagsForArticle } from '@bcm10/database';
import { authoriseInternal, badRequest, json, unauthorized } from '@/lib/api';

/**
 * On-demand cache invalidation.
 *
 * This is the endpoint that makes aggressive caching safe. The admin app calls
 * it after a publish, an edit or an unpublish, and it clears exactly the tags
 * that story touches — its own page, its section, the homepage, the sitemap
 * and the feeds — rather than rebuilding the site.
 *
 * Guarded by REVALIDATE_SECRET compared in constant time. An unauthenticated
 * caller could otherwise force a cache stampede on demand, which is a cheap
 * denial-of-service against the origin.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  slug: z.string().min(1),
  categorySlug: z.string().nullable().optional(),
  secondaryCategorySlug: z.string().nullable().optional(),
  authorSlug: z.string().nullable().optional(),
  locationSlug: z.string().nullable().optional(),
  tagSlugs: z.array(z.string()).optional(),
  previousSlug: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  if (!authoriseInternal(request, 'REVALIDATE_SECRET')) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON');
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return badRequest('Invalid payload', parsed.error.flatten());

  const subject = {
    slug: parsed.data.slug,
    categorySlug: parsed.data.categorySlug ?? null,
    secondaryCategorySlug: parsed.data.secondaryCategorySlug ?? null,
    authorSlug: parsed.data.authorSlug ?? null,
    locationSlug: parsed.data.locationSlug ?? null,
    tagSlugs: parsed.data.tagSlugs ?? [],
    previousSlug: parsed.data.previousSlug ?? null,
  };

  const tags = tagsForArticle(subject);
  const paths = pathsForArticle(subject);

  for (const tag of tags) revalidateTag(tag);
  // Paths as well as tags: the article route is rendered per-path, and a tag
  // alone does not evict a statically generated route segment.
  for (const path of paths) revalidatePath(path);

  return json({ ok: true, revalidated: { tags, paths }, at: new Date().toISOString() });
}
