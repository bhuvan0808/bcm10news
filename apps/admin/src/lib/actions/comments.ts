'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@bcm10/database/server';
import { createAdminClient } from '@bcm10/database/admin';
import { requireEditorial } from '@/lib/auth';
import { revalidatePublicSite } from '@/lib/revalidate';
import type { ActionResult } from './articles';

/**
 * Comment moderation.
 *
 * Approving a comment changes what the public page shows, so each action ends
 * by purging that story's cache. Without it a moderated comment would sit
 * invisible until the article's revalidate window expired — and a reader who
 * was told "an editor reads every comment" would conclude nobody had.
 */

async function purgeArticle(articleId: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from('articles')
    .select('slug, categories!articles_category_id_fkey(slug)')
    .eq('id', articleId)
    .maybeSingle();

  if (!data?.slug) return;

  const category = data.categories as unknown as { slug: string } | null;
  await revalidatePublicSite({ slug: data.slug, categorySlug: category?.slug ?? null });
}

export async function approveComment(commentId: string): Promise<ActionResult> {
  const session = await requireEditorial();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('comments')
    .update({
      is_approved: true,
      is_flagged: false,
      moderated_by: session.profile.id,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .select('article_id')
    .maybeSingle();

  if (error || !data) return { ok: false, message: 'Could not approve that comment.' };

  await purgeArticle(data.article_id);
  revalidatePath('/comments');
  return { ok: true, message: 'Published.' };
}

export async function rejectComment(commentId: string, reason?: string): Promise<ActionResult> {
  const session = await requireEditorial();
  const supabase = await createClient();

  // Flagged rather than deleted. A rejected comment is evidence if the same
  // person escalates, and a deleted row cannot show a pattern.
  const { data, error } = await supabase
    .from('comments')
    .update({
      is_approved: false,
      is_flagged: true,
      flagged_reason: reason ?? 'Rejected by an editor',
      moderated_by: session.profile.id,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .select('article_id')
    .maybeSingle();

  if (error || !data) return { ok: false, message: 'Could not reject that comment.' };

  await purgeArticle(data.article_id);
  revalidatePath('/comments');
  return { ok: true, message: 'Rejected.' };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  await requireEditorial();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('comments')
    .select('article_id')
    .eq('id', commentId)
    .maybeSingle();

  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) return { ok: false, message: 'Could not delete that comment.' };

  if (existing?.article_id) await purgeArticle(existing.article_id);
  revalidatePath('/comments');
  return { ok: true, message: 'Deleted.' };
}

/** Site-wide switch. Off by default, because comments need a moderation rota. */
export async function setCommentsEnabled(enabled: boolean): Promise<ActionResult> {
  const session = await requireEditorial();

  if (!session.isAdmin) {
    return { ok: false, message: 'Only a super admin can turn comments on or off site-wide.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('site_settings')
    .update({ comments_enabled: enabled, updated_by: session.profile.id })
    .eq('id', true);

  if (error) return { ok: false, message: 'Could not change that setting.' };

  await admin.rpc('write_audit_log', {
    p_action: enabled ? 'settings.comments_enabled' : 'settings.comments_disabled',
    p_resource_type: 'site_settings',
    p_resource_id: 'singleton',
    p_metadata: { by: session.profile.email },
  });

  revalidatePath('/comments');
  return {
    ok: true,
    message: enabled
      ? 'Comments are on. They still need approving one by one.'
      : 'Comments are off across the site.',
  };
}
