import Link from 'next/link';
import { cn } from '@bcm10/ui';

/**
 * Pagination.
 *
 * Real links with real hrefs, not buttons: a paginated archive must be
 * crawlable, and a reader must be able to open page 3 in a new tab. rel
 * prev/next helps search engines understand the sequence.
 */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  className,
}: {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  className?: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (lastPage <= 1) return null;

  const href = (target: number) => (target <= 1 ? basePath : `${basePath}?page=${target}`);
  const pages = pageWindow(page, lastPage);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass()}>
          ← Previous
        </Link>
      ) : null}

      {pages.map((target, index) =>
        target === null ? (
          <span key={`gap-${index}`} className="px-2 text-ink-faint" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={target}
            href={href(target)}
            aria-current={target === page ? 'page' : undefined}
            className={linkClass(target === page)}
          >
            {target}
          </Link>
        )
      )}

      {page < lastPage ? (
        <Link href={href(page + 1)} rel="next" className={linkClass()}>
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

function linkClass(active = false) {
  return cn(
    'inline-flex h-9 min-w-9 items-center justify-center rounded-sm px-3 text-sm font-semibold',
    active ? 'bg-brand text-white' : 'border border-rule text-ink hover:bg-paper-sunk'
  );
}

/**
 * First, last, and a window around the current page; `null` marks an ellipsis.
 * Keeps the control a fixed width however deep the archive gets.
 */
function pageWindow(current: number, last: number): (number | null)[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);

  const window = new Set<number>([1, last, current]);
  for (let offset = 1; offset <= 1; offset += 1) {
    if (current - offset > 1) window.add(current - offset);
    if (current + offset < last) window.add(current + offset);
  }

  const sorted = [...window].sort((a, b) => a - b);
  const result: (number | null)[] = [];

  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) result.push(null);
    result.push(value);
  });

  return result;
}
