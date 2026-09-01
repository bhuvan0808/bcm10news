'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ArticleStatus } from '@bcm10/database';
import { canTransition } from '@bcm10/validation';
import { Button, cn } from '@bcm10/ui';
import { reviewArticle } from '@/lib/actions/articles';

/**
 * The editor's review controls.
 *
 * Which buttons appear is driven by the same transition table the database
 * enforces, so an editor is never offered an action the trigger will reject.
 *
 * "Request changes" requires a comment. A story returned with no explanation
 * costs the reporter a round trip and the desk an hour, so the requirement is
 * enforced rather than suggested.
 */
export function ReviewPanel({
  articleId,
  status,
  canPublish,
}: {
  articleId: string;
  status: ArticleStatus;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'idle' | 'changes' | 'reject'>('idle');
  const [error, setError] = useState<string | null>(null);

  const act = (action: 'claimed' | 'approved' | 'changes_requested' | 'rejected') => {
    if ((action === 'changes_requested' || action === 'rejected') && comment.trim().length < 5) {
      setError('Say what needs to change — the reporter cannot act on a blank note.');
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await reviewArticle({
        id: articleId,
        action,
        comment: comment.trim() || undefined,
      });

      if (result.ok) {
        setComment('');
        setMode('idle');
        router.refresh();
      } else {
        setError(result.message ?? 'Could not record that review.');
      }
    });
  };

  // Nothing to review once a story is live or archived.
  if (status === 'published' || status === 'archived') return null;

  const canClaim = canTransition(status, 'in_review');
  const canApprove = canTransition(status, 'approved');
  const canRequestChanges = canTransition(status, 'changes_requested');

  if (!canClaim && !canApprove && !canRequestChanges) return null;

  return (
    <section
      aria-labelledby="review-heading"
      className="border-status-review/40 bg-status-review/5 rounded-sm border p-4"
    >
      <h2 id="review-heading" className="text-status-review text-sm font-bold">
        Desk review
      </h2>

      {mode !== 'idle' ? (
        <div className="mt-3">
          <label htmlFor="review-comment" className="block text-sm font-medium text-ink">
            {mode === 'changes' ? 'What needs to change?' : 'Why is this being rejected?'}
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              setError(null);
            }}
            rows={3}
            autoFocus
            placeholder={
              mode === 'changes'
                ? 'Be specific — the reporter works from this note.'
                : 'This is recorded on the story permanently.'
            }
            className={cn(
              'mt-1.5 w-full resize-y rounded-sm border bg-paper-raised px-3 py-2 text-sm',
              error ? 'border-brand' : 'border-rule-strong'
            )}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === 'idle' ? (
          <>
            {canClaim ? (
              <Button size="sm" variant="outline" onClick={() => act('claimed')} loading={pending}>
                Take it for review
              </Button>
            ) : null}

            {canRequestChanges ? (
              <Button size="sm" variant="outline" onClick={() => setMode('changes')}>
                Request changes
              </Button>
            ) : null}

            {canApprove ? (
              <Button size="sm" onClick={() => act('approved')} loading={pending}>
                {canPublish ? 'Approve for publishing' : 'Approve'}
              </Button>
            ) : null}

            <Button size="sm" variant="ghost" onClick={() => setMode('reject')}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant={mode === 'reject' ? 'danger' : 'primary'}
              onClick={() => act(mode === 'changes' ? 'changes_requested' : 'rejected')}
              loading={pending}
            >
              {mode === 'changes' ? 'Send back to the reporter' : 'Reject the story'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode('idle');
                setComment('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      {canApprove && !canPublish ? (
        <p className="mt-2 text-xs text-ink-faint">
          Approving queues the story. Someone with publishing rights puts it live.
        </p>
      ) : null}
    </section>
  );
}
