'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, cn } from '@bcm10/ui';
import {
  approveComment,
  deleteComment,
  rejectComment,
  setCommentsEnabled,
} from '@/lib/actions/comments';
import { formatRelative } from '@/lib/format';
import { publicArticleUrl } from '@/lib/site';

export interface ModerationComment {
  id: string;
  body: string;
  createdAt: string;
  isApproved: boolean;
  isFlagged: boolean;
  flaggedReason: string | null;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  authorName: string;
  authorEmail: string;
}

/**
 * Comment moderation.
 *
 * Approve and Reject are the two buttons that matter, and they are the two that
 * are always visible — reaching a decision quickly is the whole job. Delete is
 * present but quieter: rejecting keeps the row, which is what shows a pattern
 * if the same person keeps coming back.
 */
export function CommentModeration({
  comments,
  view,
  counts,
  commentsEnabled,
  isAdmin,
}: {
  comments: ModerationComment[];
  view: 'pending' | 'approved' | 'flagged';
  counts: { pending: number; approved: number; flagged: number };
  commentsEnabled: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.message ?? 'That did not work.');
    });
  };

  const tabs = [
    { key: 'pending', label: 'Waiting', count: counts.pending },
    { key: 'approved', label: 'Published', count: counts.approved },
    { key: 'flagged', label: 'Rejected', count: counts.flagged },
  ] as const;

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Comments</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {commentsEnabled
              ? 'Nothing appears on the site until it is approved here.'
              : 'Comments are switched off site-wide — readers cannot post.'}
          </p>
        </div>

        {isAdmin ? (
          <Button
            variant={commentsEnabled ? 'outline' : 'primary'}
            loading={pending}
            onClick={() => {
              const next = !commentsEnabled;
              if (
                !next ||
                window.confirm(
                  'Turning comments on means someone has to read this queue every day. Continue?'
                )
              ) {
                act(() => setCommentsEnabled(next));
              }
            }}
          >
            {commentsEnabled ? 'Turn comments off' : 'Turn comments on'}
          </Button>
        ) : null}
      </header>

      <nav aria-label="Filter" className="mt-5 flex gap-1 border-b border-rule">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/comments?filter=${tab.key}`}
            aria-current={tab.key === view ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab.key === view
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span className="ml-1.5 rounded-full bg-paper-sunk px-1.5 py-0.5 text-[11px] tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-brand">
          {error}
        </p>
      ) : null}

      {comments.length ? (
        <ul className="mt-4 divide-y divide-rule">
          {comments.map((comment) => (
            <li key={comment.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-ink-faint">
                <span className="font-semibold text-ink">{comment.authorName}</span>
                <span>{comment.authorEmail}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={comment.createdAt} suppressHydrationWarning>
                  {formatRelative(comment.createdAt)}
                </time>
              </div>

              <p className="mt-1 text-xs text-ink-faint">
                on{' '}
                <Link href={`/articles/${comment.articleId}`} className="hover:text-brand">
                  {comment.articleTitle}
                </Link>
                {comment.articleSlug ? (
                  <>
                    {' '}
                    <a
                      href={publicArticleUrl(comment.articleSlug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-brand"
                    >
                      ↗
                    </a>
                  </>
                ) : null}
              </p>

              {/* Rendered as text, never as markup. */}
              <p className="mt-2 rounded-sm bg-paper-sunk p-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {comment.body}
              </p>

              {comment.flaggedReason ? (
                <p className="mt-1 text-xs text-ink-faint">Reason: {comment.flaggedReason}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {!comment.isApproved ? (
                  <Button
                    size="sm"
                    loading={pending}
                    onClick={() => act(() => approveComment(comment.id))}
                  >
                    Approve
                  </Button>
                ) : null}

                {!comment.isFlagged ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={pending}
                    onClick={() => {
                      const reason = window.prompt('Why is this being rejected? (recorded)');
                      if (reason !== null)
                        act(() => rejectComment(comment.id, reason || undefined));
                    }}
                  >
                    Reject
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Delete permanently? Rejecting keeps the record, which is more useful if this person comes back.'
                      )
                    ) {
                      act(() => deleteComment(comment.id));
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-sm border border-dashed border-rule p-10 text-center">
          <p className="font-semibold text-ink">
            {view === 'pending' ? 'Queue is clear' : `Nothing ${view}`}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {view === 'pending'
              ? 'Every comment has been read.'
              : 'Comments will show here as they are moderated.'}
          </p>
        </div>
      )}
    </div>
  );
}
