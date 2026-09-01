import type { ArticleStatus } from '@bcm10/database';
import { cn } from '@bcm10/ui';

/**
 * Workflow status pill.
 *
 * Colour plus text, never colour alone — roughly one in twelve men has some
 * form of colour blindness, and a queue that encodes state only in a hue is
 * unreadable to them.
 */
const STATUS: Record<ArticleStatus, { label: string; dot: string; text: string; bg: string }> = {
  draft: { label: 'Draft', dot: 'bg-status-draft', text: 'text-status-draft', bg: 'bg-status-draft/10' },
  submitted: {
    label: 'Submitted',
    dot: 'bg-status-submitted',
    text: 'text-status-submitted',
    bg: 'bg-status-submitted/10',
  },
  in_review: {
    label: 'In review',
    dot: 'bg-status-review',
    text: 'text-status-review',
    bg: 'bg-status-review/10',
  },
  changes_requested: {
    label: 'Changes requested',
    dot: 'bg-status-changes',
    text: 'text-status-changes',
    bg: 'bg-status-changes/10',
  },
  approved: {
    label: 'Approved',
    dot: 'bg-status-approved',
    text: 'text-status-approved',
    bg: 'bg-status-approved/10',
  },
  scheduled: {
    label: 'Scheduled',
    dot: 'bg-status-scheduled',
    text: 'text-status-scheduled',
    bg: 'bg-status-scheduled/10',
  },
  published: {
    label: 'Published',
    dot: 'bg-status-published',
    text: 'text-status-published',
    bg: 'bg-status-published/10',
  },
  archived: {
    label: 'Archived',
    dot: 'bg-status-archived',
    text: 'text-status-archived',
    bg: 'bg-status-archived/10',
  },
};

export function StatusBadge({ status, className }: { status: ArticleStatus; className?: string }) {
  const config = STATUS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dot)} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function statusLabel(status: ArticleStatus): string {
  return STATUS[status].label;
}
