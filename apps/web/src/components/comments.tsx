import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { CommentForm } from './comment-form';
import { formatRelative } from '@/lib/format';
import { articlePath } from '@/lib/site';

/**
 * Reader comments.
 *
 * A server component: the thread is the same for everyone (RLS returns only
 * approved comments, plus the reader's own pending ones), so it renders on the
 * server and only the form ships JavaScript.
 *
 * Threading is one level deep. Deeper nesting is unreadable on a phone and
 * turns every argument into a tree nobody follows.
 */
export async function Comments({
  articleId,
  articleSlug,
  allowComments,
}: {
  articleId: string;
  articleSlug: string;
  allowComments: boolean;
}) {
  const supabase = await createClient();

  const [{ data: settings }, { data: user }] = await Promise.all([
    supabase.from('site_settings').select('comments_enabled').limit(1).maybeSingle(),
    supabase.auth.getUser().then((result) => ({ data: result.data.user })),
  ]);

  // Two switches, both must be on: the site-wide setting and the per-story flag.
  // A newsroom without a moderation rota can turn the whole thing off centrally.
  if (!settings?.comments_enabled || !allowComments) return null;

  const { data: rows } = await supabase
    .from('comments')
    .select(
      'id, body, created_at, parent_id, is_approved, profile_id, profiles!comments_profile_id_fkey(display_name, full_name)'
    )
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })
    .limit(200);

  const comments = (rows ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      display_name: string | null;
      full_name: string;
    } | null;
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      parentId: row.parent_id,
      isApproved: row.is_approved,
      isMine: row.profile_id === user?.id,
      author: profile?.display_name || profile?.full_name || 'Reader',
    };
  });

  const roots = comments.filter((comment) => !comment.parentId);
  const repliesByParent = new Map<string, typeof comments>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const existing = repliesByParent.get(comment.parentId) ?? [];
    existing.push(comment);
    repliesByParent.set(comment.parentId, existing);
  }

  const approvedCount = comments.filter((comment) => comment.isApproved).length;

  return (
    <section aria-labelledby="comments-heading" className="mt-12 border-t border-rule pt-8">
      <h2 id="comments-heading" className="text-xl font-black tracking-tight text-ink">
        Comments
        {approvedCount > 0 ? (
          <span className="ml-2 text-base font-normal text-ink-faint">{approvedCount}</span>
        ) : null}
      </h2>

      {user ? (
        <CommentForm articleId={articleId} className="mt-4" />
      ) : (
        <p className="mt-4 rounded-sm border border-rule bg-paper-raised p-4 text-sm text-ink-muted">
          <Link
            href={`/account?from=${encodeURIComponent(articlePath(articleSlug))}`}
            className="font-semibold text-brand hover:underline"
          >
            Sign in
          </Link>{' '}
          to join the discussion. Comments are read by an editor before they appear.
        </p>
      )}

      {roots.length ? (
        <ol className="mt-6 space-y-5">
          {roots.map((comment) => (
            <li key={comment.id}>
              <CommentBody comment={comment} />

              {repliesByParent.get(comment.id)?.length ? (
                <ol className="mt-3 space-y-3 border-l-2 border-rule pl-4">
                  {repliesByParent.get(comment.id)!.map((reply) => (
                    <li key={reply.id}>
                      <CommentBody comment={reply} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm text-ink-faint">
          No comments yet. Be the first — keep it civil and on the story.
        </p>
      )}
    </section>
  );
}

function CommentBody({
  comment,
}: {
  comment: {
    id: string;
    body: string;
    createdAt: string;
    isApproved: boolean;
    isMine: boolean;
    author: string;
  };
}) {
  return (
    <article className={comment.isApproved ? '' : 'rounded-sm bg-paper-sunk/60 p-3'}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-ink">{comment.author}</span>
        <time
          dateTime={comment.createdAt}
          className="text-xs text-ink-faint"
          suppressHydrationWarning
        >
          {formatRelative(comment.createdAt)}
        </time>
        {!comment.isApproved && comment.isMine ? (
          <span className="rounded-xs bg-paper-sunk px-1.5 py-0.5 text-[10px] font-bold text-ink-muted uppercase">
            Awaiting an editor
          </span>
        ) : null}
      </div>

      {/* Plain text, rendered as text. Comment bodies are never HTML. */}
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink">{comment.body}</p>
    </article>
  );
}
