'use client';

import posthog from 'posthog-js';
import { PostHogProvider as Provider } from 'posthog-js/react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { AnalyticsEventName, PropertiesFor } from './events';

/**
 * Browser analytics.
 *
 * Two deliberate choices:
 *
 *  1. Autocapture is off. On a news site it produces enormous volumes of
 *     clicks on story links that duplicate `article_view` while telling you
 *     less, and it captures DOM text we have not reviewed for PII.
 *  2. Pageviews are captured manually. The App Router does not do a document
 *     load between routes, so PostHog's automatic capture would miss every
 *     navigation after the first.
 */

let initialised = false;

export function initAnalytics(): void {
  if (initialised || typeof window === 'undefined') return;

  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
  if (!key) return;

  posthog.init(key, {
    api_host: process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage+cookie',
    // Readers arrive anonymous and are linked to an account on login.
    person_profiles: 'identified_only',
    // Masking is the default we want: a news site has no reason to record the
    // contents of a comment box or a search field in a replay.
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-private]',
    },
  });

  initialised = true;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  if (!process.env['NEXT_PUBLIC_POSTHOG_KEY']) return <>{children}</>;
  return <Provider client={posthog}>{children}</Provider>;
}

/** Type-safe capture. An unknown event name is a compile error. */
export function capture<N extends AnalyticsEventName>(name: N, properties: PropertiesFor<N>): void {
  if (!initialised) return;
  posthog.capture(name, properties as Record<string, unknown>);
}

/** Links the anonymous history to the account after sign-in. */
export function identifyReader(
  userId: string,
  traits: { subscription_status?: string; role?: string; language?: string } = {}
): void {
  if (!initialised) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics(): void {
  if (!initialised) return;
  posthog.reset();
}

export function isFeatureEnabled(flag: string): boolean {
  if (!initialised) return false;
  return posthog.isFeatureEnabled(flag) ?? false;
}

/**
 * Reports 25/50/75/100% read depth exactly once each.
 *
 * Depth is measured against the article element's own scroll extent rather
 * than the window's, so a long comment thread or a tall footer cannot inflate
 * it. `hit` is a ref, so re-renders never re-fire a milestone.
 */
export function useReadDepth(
  elementRef: React.RefObject<HTMLElement | null>,
  onMilestone: (depth: 25 | 50 | 75 | 100) => void
): void {
  const hit = useRef<Set<number>>(new Set());

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;

      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const percent = (scrolled / total) * 100;

      for (const milestone of [25, 50, 75, 100] as const) {
        if (percent >= milestone && !hit.current.has(milestone)) {
          hit.current.add(milestone);
          onMilestone(milestone);
        }
      }
    };

    const onScroll = () => {
      // rAF-coalesced: scroll fires far more often than we need to measure.
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    measure();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [elementRef, onMilestone]);
}
