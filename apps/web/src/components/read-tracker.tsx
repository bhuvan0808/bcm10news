'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ArticleContext } from '@bcm10/analytics';
import { capture, useReadDepth } from '@bcm10/analytics/client';

/**
 * Read tracking.
 *
 * Two separate concerns, on purpose:
 *
 *  • PostHog gets the funnel events (view, 25/50/75/100% depth). That is
 *    product analytics and lives with the vendor.
 *  • Our own `article_views` table gets one first-party row per read, because
 *    "most read" and B2B licence reporting must not depend on a third party
 *    that an ad-blocker can remove. The write goes through a SECURITY DEFINER
 *    RPC, so the table needs no INSERT policy.
 *
 * Renders nothing.
 */
export function ReadTracker({
  articleId,
  context,
  targetRef,
}: {
  articleId: string;
  context: ArticleContext;
  targetRef: React.RefObject<HTMLElement | null>;
}) {
  const recorded = useRef(false);

  useEffect(() => {
    // React 18+ mounts effects twice in development StrictMode; the ref guard
    // stops that double-counting a read.
    if (recorded.current) return;
    recorded.current = true;

    capture('article_view', context);

    // keepalive so the beacon survives the reader navigating away immediately.
    void fetch('/api/track/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, referrerHost: safeReferrerHost() }),
      keepalive: true,
    }).catch(() => {
      /* Analytics must never surface an error to a reader. */
    });
  }, [articleId, context]);

  const onMilestone = useCallback(
    (depth: 25 | 50 | 75 | 100) => {
      capture(`article_read_${depth}` as 'article_read_25', context);
    },
    [context]
  );

  useReadDepth(targetRef, onMilestone);

  return null;
}

/** Host only — never the full referring URL, which can carry query strings. */
function safeReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined;
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return undefined;
  }
}
