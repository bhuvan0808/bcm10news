/**
 * The analytics event schema.
 *
 * One typed union, shared by browser and server. The point is that
 * `capture('artcle_view', ...)` will not compile — an event name typo produces
 * a silently empty funnel weeks later, and that is expensive to discover.
 *
 * Properties are deliberately non-identifying. Never put an email, phone
 * number or full name in an event payload.
 */

export interface ArticleContext {
  article_id: string;
  article_slug: string;
  category: string;
  author_id: string;
  is_premium: boolean;
  is_breaking: boolean;
  reading_time_minutes: number;
  language: 'te' | 'en';
}

export interface ReaderContext {
  logged_in: boolean;
  subscription_status: 'none' | 'active' | 'trialing' | 'past_due' | 'cancelled';
}

export type AnalyticsEvent =
  | { name: 'page_view'; properties: { path: string; referrer?: string } }
  | { name: 'article_view'; properties: ArticleContext & Partial<ReaderContext> }
  | { name: 'article_read_25'; properties: ArticleContext }
  | { name: 'article_read_50'; properties: ArticleContext }
  | { name: 'article_read_75'; properties: ArticleContext }
  | { name: 'article_read_100'; properties: ArticleContext }
  | { name: 'article_share'; properties: ArticleContext & { channel: string } }
  | { name: 'article_save'; properties: ArticleContext & { saved: boolean } }
  | { name: 'video_start'; properties: ArticleContext & { video_id: string } }
  | { name: 'video_complete'; properties: ArticleContext & { video_id: string } }
  | { name: 'search'; properties: { query_length: number; results: number; category?: string } }
  | { name: 'search_result_click'; properties: { position: number; article_id: string } }
  | { name: 'newsletter_signup'; properties: { source: string; kinds: string[] } }
  | { name: 'push_opt_in'; properties: { topics: string[] } }
  | { name: 'premium_content_view'; properties: ArticleContext & { had_access: boolean } }
  | { name: 'subscription_checkout'; properties: { plan_code: string; amount_paise: number } }
  | { name: 'subscription_started'; properties: { plan_code: string; amount_paise: number } }
  | { name: 'payment_success'; properties: { plan_code: string; amount_paise: number } }
  | { name: 'payment_failed'; properties: { plan_code: string; reason?: string } }
  | { name: 'subscription_cancelled'; properties: { plan_code: string; reason?: string } }
  | { name: 'license_purchase'; properties: { organization_id: string; plan_code: string } }
  | { name: 'license_usage'; properties: { organization_id: string; article_id: string; action: string } }
  // Newsroom-side events, so editorial throughput is measurable too.
  | { name: 'story_submitted'; properties: { article_id: string; category: string } }
  | { name: 'story_published'; properties: { article_id: string; category: string; minutes_in_review: number } };

export type AnalyticsEventName = AnalyticsEvent['name'];

export type PropertiesFor<N extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { name: N }
>['properties'];

/** Article context for an event, derived once per page. */
export function articleContext(article: {
  id: string;
  slug: string;
  category_slug: string;
  author_id: string;
  is_premium: boolean;
  is_breaking: boolean;
  reading_time_minutes: number;
  language: 'te' | 'en';
}): ArticleContext {
  return {
    article_id: article.id,
    article_slug: article.slug,
    category: article.category_slug,
    author_id: article.author_id,
    is_premium: article.is_premium,
    is_breaking: article.is_breaking,
    reading_time_minutes: article.reading_time_minutes,
    language: article.language,
  };
}
