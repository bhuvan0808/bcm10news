'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, cn } from '@bcm10/ui';

/**
 * Comment form.
 *
 * Says plainly that a comment is moderated before it appears. A reader who
 * posts and sees nothing assumes the site is broken and posts again; telling
 * them upfront prevents both the duplicate and the complaint.
 */
export function CommentForm({ articleId, className }: { articleId: string; className?: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [state, setState] = useState<{
    status: 'idle' | 'sending' | 'done' | 'error';
    message?: string;
  }>({
    status: 'idle',
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (body.trim().length < 2) return;

    setState({ status: 'sending' });

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, body: body.trim() }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({ status: 'error', message: payload.message ?? 'Could not post that.' });
        return;
      }

      setState({ status: 'done', message: payload.message });
      setBody('');
      // Refresh so their own pending comment appears, marked as awaiting review.
      router.refresh();
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' });
    }
  };

  if (state.status === 'done') {
    return (
      <p
        role="status"
        className={cn('rounded-sm border border-rule bg-paper-raised p-4 text-sm', className)}
      >
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn('space-y-2', className)}>
      <label htmlFor="comment-body" className="sr-only">
        Your comment
      </label>
      <textarea
        id="comment-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Add to the discussion…"
        className="w-full resize-y rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-faint">An editor reads every comment before it appears.</p>
        <Button
          type="submit"
          size="sm"
          loading={state.status === 'sending'}
          disabled={body.trim().length < 2}
        >
          Post comment
        </Button>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-xs font-medium text-brand">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
