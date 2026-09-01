import type { PushTopic } from '@bcm10/validation';

/**
 * Web push.
 *
 * Breaking news is the one case where interrupting a reader is justified, so
 * the interface is narrow on purpose: send to a topic, with a headline and a
 * link. There is no general "send arbitrary notification" method.
 *
 * OneSignal is reached over its REST API rather than its Node SDK — one HTTP
 * call, no extra dependency, and the payload stays legible.
 */

export interface PushMessage {
  topic: PushTopic;
  heading: string;
  content: string;
  url: string;
  imageUrl?: string | null;
  /** Collapse id: a re-send about the same story replaces the earlier one. */
  collapseId?: string;
  language?: 'te' | 'en';
}

export interface PushResult {
  ok: boolean;
  notificationId: string | null;
  recipients: number | null;
  error?: string;
  skipped?: boolean;
}

export interface NotificationService {
  readonly enabled: boolean;
  send(message: PushMessage): Promise<PushResult>;
}

const ONESIGNAL_API = 'https://api.onesignal.com/notifications';

export class OneSignalNotificationService implements NotificationService {
  readonly enabled = true;

  constructor(
    private readonly appId: string,
    private readonly restApiKey: string
  ) {}

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const response = await fetch(ONESIGNAL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Key ${this.restApiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          // Readers choose topics; a subscriber to sports must not be woken by
          // a cinema alert.
          filters: [{ field: 'tag', key: 'topic', relation: '=', value: message.topic }],
          headings: { en: message.heading },
          contents: { en: message.content },
          url: message.url,
          chrome_web_image: message.imageUrl ?? undefined,
          web_push_topic: message.collapseId ?? message.topic,
          // 6 hours: a breaking alert delivered the next morning is noise.
          ttl: 6 * 60 * 60,
          priority: 10,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const payload = (await response.json()) as {
        id?: string;
        recipients?: number;
        errors?: string[] | Record<string, unknown>;
      };

      if (!response.ok || (Array.isArray(payload.errors) && payload.errors.length)) {
        return {
          ok: false,
          notificationId: null,
          recipients: null,
          error: Array.isArray(payload.errors)
            ? payload.errors.join('; ')
            : `OneSignal responded ${response.status}`,
        };
      }

      return {
        ok: true,
        notificationId: payload.id ?? null,
        recipients: payload.recipients ?? null,
      };
    } catch (cause) {
      return {
        ok: false,
        notificationId: null,
        recipients: null,
        error: cause instanceof Error ? cause.message : 'Unknown push error',
      };
    }
  }
}

/**
 * Used before OneSignal is configured. Publishing must work without push, so
 * this reports `skipped` rather than failing the publish.
 */
export class NoopNotificationService implements NotificationService {
  readonly enabled = false;

  async send(message: PushMessage): Promise<PushResult> {
    console.info(`[push:noop] ${message.topic}: ${message.heading}`);
    return { ok: true, notificationId: null, recipients: null, skipped: true };
  }
}

export function createNotificationService(
  env: NodeJS.ProcessEnv = process.env
): NotificationService {
  const appId = env['ONESIGNAL_APP_ID'] ?? env['NEXT_PUBLIC_ONESIGNAL_APP_ID'];
  const restApiKey = env['ONESIGNAL_REST_API_KEY'];

  if (!appId || !restApiKey) return new NoopNotificationService();
  return new OneSignalNotificationService(appId, restApiKey);
}

/** Maps a category slug to its push topic. Unmapped desks fall back to breaking. */
export function topicForCategory(categorySlug: string): PushTopic {
  const map: Record<string, PushTopic> = {
    politics: 'politics',
    sports: 'sports',
    cinema: 'cinema',
    business: 'business',
    technology: 'technology',
    'andhra-pradesh': 'andhra_pradesh',
    telangana: 'telangana',
    national: 'national',
    international: 'international',
  };
  return map[categorySlug] ?? 'breaking_news';
}
