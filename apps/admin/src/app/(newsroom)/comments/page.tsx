import { createClient } from '@bcm10/database/server';
import { CommentModeration, type ModerationComment } from '@/components/comment-moderation';
import { requireEditorial } from '@/lib/auth';

export const metadata = { title: 'Comments' };

/**
 * Moderation queue.
 *
 * Pending first, oldest first — a reader was told an editor would read their
 * comment, and a queue sorted newest-first quietly buries the ones that have
 * been waiting longest.
 */
export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireEditorial('/comments');
  const supabase = await createClient();

  const { filter } = await searchParams;
  const view = filter === 'approved' || filter === 'flagged' ? filter : 'pending';

  let query = supabase
    .from('comments')
    .select(
      'id, body, created_at, is_approved, is_flagged, flagged_reason, article_id, profiles(email, display_name, full_name), articles(title, slug)'
    )
    .order('created_at', { ascending: view === 'pending' })
    .limit(100);

  if (view === 'pending') query = query.eq('is_approved', false).eq('is_flagged', false);
  else if (view === 'approved') query = query.eq('is_approved', true);
  else query = query.eq('is_flagged', true);

  const [{ data }, { data: settings }, counts] = await Promise.all([
    query,
    supabase.from('site_settings').select('comments_enabled').limit(1).maybeSingle(),
    supabase
      .from('comments')
      .select('is_approved, is_flagged')
      .limit(1000)
      .then(({ data: rows }) => ({
        pending: (rows ?? []).filter((r) => !r.is_approved && !r.is_flagged).length,
        approved: (rows ?? []).filter((r) => r.is_approved).length,
        flagged: (rows ?? []).filter((r) => r.is_flagged).length,
      })),
  ]);

  const comments: ModerationComment[] = (data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      email: string;
      display_name: string | null;
      full_name: string;
    } | null;
    const article = row.articles as unknown as { title: string; slug: string } | null;

    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      isApproved: row.is_approved,
      isFlagged: row.is_flagged,
      flaggedReason: row.flagged_reason,
      articleId: row.article_id,
      articleTitle: article?.title ?? 'Deleted story',
      articleSlug: article?.slug ?? '',
      authorName: profile?.display_name || profile?.full_name || 'Reader',
      authorEmail: profile?.email ?? '',
    };
  });

  return (
    <CommentModeration
      comments={comments}
      view={view}
      counts={counts}
      commentsEnabled={settings?.comments_enabled ?? false}
      isAdmin={session.isAdmin}
    />
  );
}
