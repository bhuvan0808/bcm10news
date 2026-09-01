'use client';

import { useRef } from 'react';
import type { ArticleContext } from '@bcm10/analytics';
import { ReadTracker } from '@/components/read-tracker';

/**
 * Wraps the article body so read depth can be measured against the story
 * itself rather than the whole document.
 *
 * A ref is needed to do that, and a ref means a client component — but the
 * body inside it stays a server-rendered child passed through `children`, so
 * none of the article's markup or its renderer ships to the browser.
 */
export function ArticleReadTracking({
  articleId,
  context,
  children,
}: {
  articleId: string;
  context: ArticleContext;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="mt-6">
      {children}
      <ReadTracker articleId={articleId} context={context} targetRef={ref} />
    </div>
  );
}
