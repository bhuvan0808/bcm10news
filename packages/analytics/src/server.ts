import { PostHog } from 'posthog-node';
import type { AnalyticsEventName, PropertiesFor } from './events';

/**
 * Server-side analytics.
 *
 * Used for events a browser cannot be trusted to report or would not see at
 * all: webhook-confirmed payments, editorial workflow transitions, cron
 * outcomes. A `payment_success` fired from the browser would be both
 * spoofable and missing whenever the reader closed the tab.
 */
let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'] ?? process.env['POSTHOG_API_KEY'];
  if (!key) return null;

  client ??= new PostHog(key, {
    host: process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com',
    // Serverless functions are short-lived; flush promptly rather than batching
    // into an instance that is about to be frozen.
    flushAt: 1,
    flushInterval: 0,
  });

  return client;
}

export async function captureServer<N extends AnalyticsEventName>(
  distinctId: string,
  name: N,
  properties: PropertiesFor<N>
): Promise<void> {
  const posthog = getClient();
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId,
      event: name,
      properties: properties as Record<string, unknown>,
    });
    await posthog.flush();
  } catch {
    // Analytics must never fail the request that produced the event.
  }
}

export async function shutdownAnalytics(): Promise<void> {
  if (!client) return;
  await client.shutdown();
  client = null;
}
