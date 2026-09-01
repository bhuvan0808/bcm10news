import type { ArticleStatusHistoryRow, EditorReviewRow } from '@bcm10/database';
import { statusLabel } from './status-badge';
import { formatDateTime } from '@/lib/format';

/**
 * The story's history.
 *
 * This is the journalistic record, and it is why the workflow tables are
 * written by database triggers rather than by application code: who wrote it,
 * who changed it, who approved it, and when. A row here cannot be missing
 * because someone took a different code path.
 *
 * Status changes and review comments are two tables; they are merged and
 * sorted here so an editor reads one narrative instead of cross-referencing.
 */
type TimelineEntry =
  | { kind: 'status'; at: string; row: ArticleStatusHistoryRow }
  | { kind: 'review'; at: string; row: EditorReviewRow };

export function StoryTimeline({
  history,
  reviews,
}: {
  history: ArticleStatusHistoryRow[];
  reviews: EditorReviewRow[];
}) {
  const entries: TimelineEntry[] = [
    ...history.map((row) => ({ kind: 'status' as const, at: row.created_at, row })),
    ...reviews
      // A review with no comment adds nothing the status change did not say.
      .filter((row) => row.comment)
      .map((row) => ({ kind: 'review' as const, at: row.created_at, row })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (!entries.length) return null;

  return (
    <section
      aria-labelledby="timeline-heading"
      className="rounded-sm border border-rule bg-paper-raised p-4"
    >
      <h2
        id="timeline-heading"
        className="text-xs font-bold tracking-wider text-ink-muted uppercase"
      >
        History
      </h2>

      <ol className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={`${entry.kind}-${entry.row.id}`} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-rule-strong"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              {entry.kind === 'status' ? (
                <p className="text-sm text-ink">
                  {entry.row.from_status ? (
                    <>
                      Moved from <strong>{statusLabel(entry.row.from_status)}</strong> to{' '}
                      <strong>{statusLabel(entry.row.to_status)}</strong>
                    </>
                  ) : (
                    <>
                      Created as <strong>{statusLabel(entry.row.to_status)}</strong>
                    </>
                  )}
                </p>
              ) : (
                <p className="text-sm text-ink">
                  <strong>{formatAction(entry.row.action)}</strong>
                  <span className="mt-0.5 block whitespace-pre-wrap text-ink-muted">
                    {entry.row.comment}
                  </span>
                </p>
              )}

              <time
                dateTime={entry.at}
                className="mt-0.5 block text-xs text-ink-faint"
                suppressHydrationWarning
              >
                {formatDateTime(entry.at)} IST
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatAction(action: EditorReviewRow['action']): string {
  const labels: Record<string, string> = {
    submitted: 'Submitted for review',
    claimed: 'Picked up for review',
    approved: 'Approved',
    changes_requested: 'Changes requested',
    rejected: 'Rejected',
    published: 'Published',
    scheduled: 'Scheduled',
    unpublished: 'Taken down',
    archived: 'Archived',
    restored: 'Restored',
  };
  return labels[action] ?? action;
}
