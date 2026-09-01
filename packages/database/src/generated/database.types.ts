/**
 * Database types.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER — hand-authored to match supabase/migrations exactly, so the
 * workspace is fully typed before a Supabase project exists.
 *
 * Once the hosted project is linked, replace this file wholesale with:
 *
 *     npm run db:types
 *
 * The shape below is structurally compatible with what the generator emits
 * (Row / Insert / Update per table, Enums, Functions), so swapping it in is a
 * drop-in change rather than a refactor.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
export type UserRole =
  | 'super_admin'
  | 'managing_editor'
  | 'editor'
  | 'reporter'
  | 'photographer'
  | 'subscription_manager'
  | 'business_customer'
  | 'reader';

export type ArticleStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

export type ReviewAction =
  | 'submitted'
  | 'claimed'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'published'
  | 'scheduled'
  | 'unpublished'
  | 'archived'
  | 'restored';

export type MediaKind = 'image' | 'document' | 'audio' | 'avatar';
export type VideoProvider = 'youtube';
export type ContentLanguage = 'te' | 'en';
export type SubscriptionStatus =
  'incomplete' | 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired';
export type PlanInterval = 'one_time' | 'monthly' | 'quarterly' | 'annual';
export type PlanAudience = 'reader' | 'business';
export type PaymentStatus =
  'created' | 'authorized' | 'captured' | 'refunded' | 'partially_refunded' | 'failed';
export type EntitlementKind =
  'premium_content' | 'ad_light' | 'newsletter_premium' | 'content_license' | 'api_access';
export type NewsletterKind =
  | 'daily_digest'
  | 'morning_briefing'
  | 'evening_briefing'
  | 'breaking_news'
  | 'category_digest'
  | 'weekly_roundup';
export type EmailEventKind =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'delivery_delayed'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed';
export type PushTopic =
  | 'breaking_news'
  | 'politics'
  | 'sports'
  | 'cinema'
  | 'business'
  | 'technology'
  | 'andhra_pradesh'
  | 'telangana'
  | 'national'
  | 'international';

// -----------------------------------------------------------------------------
// Row shapes
// -----------------------------------------------------------------------------
export type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  display_name_te: string | null;
  slug: string | null;
  role: UserRole;
  is_active: boolean;
  can_publish: boolean;
  can_send_push: boolean;
  can_manage_media_library: boolean;
  avatar_media_id: string | null;
  bio: string | null;
  bio_te: string | null;
  designation: string | null;
  phone: string | null;
  social_links: Json;
  preferred_language: ContentLanguage;
  timezone: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  name_te: string | null;
  description: string | null;
  position: number;
  color: string | null;
  icon: string | null;
  show_in_nav: boolean;
  show_on_homepage: boolean;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type LocationRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  name_te: string | null;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TagRow = {
  id: string;
  slug: string;
  name: string;
  name_te: string | null;
  description: string | null;
  usage_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

export type MediaRow = {
  id: string;
  kind: MediaKind;
  bucket: string;
  storage_key: string;
  driver: string;
  checksum: string | null;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  blur_data_url: string | null;
  dominant_color: string | null;
  title: string | null;
  alt_text: string | null;
  alt_text_te: string | null;
  caption: string | null;
  caption_te: string | null;
  credit: string | null;
  copyright: string | null;
  source: string | null;
  photographer_id: string | null;
  captured_at: string | null;
  variants: Json;
  uploaded_by: string | null;
  usage_count: number;
  is_archived: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type UploadTicketRow = {
  id: string;
  requested_by: string;
  bucket: string;
  storage_key: string;
  mime_type: string;
  max_size_bytes: number;
  kind: MediaKind;
  consumed_at: string | null;
  expires_at: string;
  created_at: string;
};

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  title_te: string | null;
  subtitle: string | null;
  excerpt: string | null;
  language: ContentLanguage;
  body: Json;
  body_text: string;
  author_id: string;
  byline_override: string | null;
  editor_id: string | null;
  category_id: string;
  secondary_category_id: string | null;
  location_id: string | null;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_for: string | null;
  first_published_at: string | null;
  unpublished_at: string | null;
  is_breaking: boolean;
  is_exclusive: boolean;
  is_premium: boolean;
  is_featured: boolean;
  is_sponsored: boolean;
  allow_comments: boolean;
  allow_syndication: boolean;
  priority: number;
  preview_paragraphs: number;
  featured_image_id: string | null;
  featured_video_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image_id: string | null;
  noindex: boolean;
  view_count: number;
  share_count: number;
  comment_count: number;
  reading_time_minutes: number;
  word_count: number;
  created_at: string;
  updated_at: string;
};

/** public.article_previews — safe, body-free projection of published stories. */
export type ArticlePreviewRow = {
  id: string;
  slug: string;
  title: string;
  title_te: string | null;
  subtitle: string | null;
  excerpt: string | null;
  language: ContentLanguage;
  author_id: string;
  byline_override: string | null;
  category_id: string;
  secondary_category_id: string | null;
  location_id: string | null;
  published_at: string;
  updated_at: string;
  first_published_at: string | null;
  is_breaking: boolean;
  is_exclusive: boolean;
  is_premium: boolean;
  is_featured: boolean;
  is_sponsored: boolean;
  priority: number;
  reading_time_minutes: number;
  word_count: number;
  view_count: number;
  comment_count: number;
  share_count: number;
  featured_image_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  category_slug: string;
  category_name: string;
  category_name_te: string | null;
  location_slug: string | null;
  location_name: string | null;
  location_name_te: string | null;
  author_slug: string | null;
  author_name: string;
  author_name_te: string | null;
  featured_image_key: string | null;
  featured_image_alt: string | null;
  featured_image_alt_te: string | null;
  featured_image_caption: string | null;
  featured_image_credit: string | null;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_blur: string | null;
  featured_image_variants: Json;
};

export type AuthorProfileRow = {
  id: string;
  slug: string;
  name: string;
  name_te: string | null;
  bio: string | null;
  bio_te: string | null;
  designation: string | null;
  social_links: Json;
  role: UserRole;
  avatar_key: string | null;
  article_count: number;
};

export type ArticleVideoRow = {
  id: string;
  article_id: string;
  provider: VideoProvider;
  video_id: string;
  original_url: string;
  is_short: boolean;
  title: string | null;
  caption: string | null;
  caption_te: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ArticleMediaRow = {
  id: string;
  article_id: string;
  media_id: string;
  role: string;
  caption: string | null;
  caption_te: string | null;
  position: number;
  created_at: string;
};

export type ArticleRevisionRow = {
  id: string;
  article_id: string;
  version: number;
  title: string;
  title_te: string | null;
  subtitle: string | null;
  excerpt: string | null;
  body: Json;
  body_text: string;
  status: ArticleStatus;
  is_published_version: boolean;
  created_by: string | null;
  change_summary: string | null;
  created_at: string;
};

export type ArticleStatusHistoryRow = {
  id: string;
  article_id: string;
  from_status: ArticleStatus | null;
  to_status: ArticleStatus;
  action: ReviewAction | null;
  actor_id: string | null;
  note: string | null;
  created_at: string;
};

export type EditorReviewRow = {
  id: string;
  article_id: string;
  reviewer_id: string;
  action: ReviewAction;
  comment: string | null;
  anchor: Json | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

export type ArticleAssignmentRow = {
  id: string;
  article_id: string | null;
  assigned_to: string;
  assigned_by: string;
  brief: string;
  category_id: string | null;
  location_id: string | null;
  due_at: string | null;
  priority: number;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommentRow = {
  id: string;
  article_id: string;
  parent_id: string | null;
  profile_id: string;
  body: string;
  is_approved: boolean;
  is_flagged: boolean;
  flagged_reason: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlanRow = {
  id: string;
  code: string;
  name: string;
  name_te: string | null;
  description: string | null;
  audience: PlanAudience;
  interval: PlanInterval;
  amount_paise: number;
  currency: string;
  trial_days: number;
  entitlements: EntitlementKind[];
  license_quota: number | null;
  provider: string;
  provider_plan_id: string | null;
  is_active: boolean;
  is_public: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  id: string;
  profile_id: string | null;
  organization_id: string | null;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  ended_at: string | null;
  provider: string;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  subscription_id: string | null;
  profile_id: string | null;
  organization_id: string | null;
  status: PaymentStatus;
  amount_paise: number;
  amount_refunded_paise: number;
  currency: string;
  method: string | null;
  description: string | null;
  failure_reason: string | null;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  provider_signature: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EntitlementRow = {
  id: string;
  profile_id: string | null;
  organization_id: string | null;
  subscription_id: string | null;
  kind: EntitlementKind;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  source: string;
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  gstin: string | null;
  billing_email: string;
  billing_address: Json;
  contact_phone: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentLicenseRow = {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  name: string;
  quota_per_period: number | null;
  used_this_period: number;
  period_start: string;
  period_end: string | null;
  allow_full_text: boolean;
  allow_images: boolean;
  allow_republish: boolean;
  allow_api: boolean;
  allowed_category_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HomepageSectionRow = {
  id: string;
  key: string;
  title: string;
  title_te: string | null;
  layout: 'hero' | 'grid' | 'list' | 'carousel' | 'video' | 'gallery' | 'compact';
  source:
    | 'category'
    | 'tag'
    | 'location'
    | 'latest'
    | 'most_read'
    | 'editors_picks'
    | 'manual'
    | 'videos'
    | 'photos';
  category_id: string | null;
  tag_id: string | null;
  location_id: string | null;
  manual_article_ids: string[];
  item_limit: number;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SiteSettingsRow = {
  id: boolean;
  site_name: string;
  tagline: string | null;
  tagline_te: string | null;
  logo_media_id: string | null;
  default_og_media_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  office_address: string | null;
  social_links: Json;
  breaking_ticker_enabled: boolean;
  breaking_ticker_ttl_minutes: number;
  comments_enabled: boolean;
  paywall_enabled: boolean;
  push_enabled: boolean;
  newsletter_enabled: boolean;
  ads_txt: string | null;
  robots_extra: string | null;
  announcement: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  profile_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Json;
  read_at: string | null;
  created_at: string;
};

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  profile_id: string | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
  confirmation_token: string | null;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  kinds: NewsletterKind[];
  category_ids: string[];
  language: ContentLanguage;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type PushSubscriberRow = {
  id: string;
  provider: string;
  provider_player_id: string;
  profile_id: string | null;
  topics: PushTopic[];
  device_kind: string | null;
  language: ContentLanguage;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: UserRole | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Json;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
};

export type TrendingArticleRow = {
  article_id: string;
  views_24h: number;
  views_1h: number;
  last_viewed_at: string;
};

// -----------------------------------------------------------------------------
// Table map
// -----------------------------------------------------------------------------
/**
 * Generated columns and defaults make most fields optional on insert. The
 * generator distinguishes these precisely; here we approximate with a
 * required-key list per table, which is enough for the compiler to catch a
 * missing NOT NULL column.
 */
type Table<Row, RequiredOnInsert extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredOnInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id' | 'email'>;
      organizations: Table<OrganizationRow, 'name' | 'slug' | 'billing_email'>;
      organization_members: Table<
        { organization_id: string; profile_id: string; is_owner: boolean; created_at: string },
        'organization_id' | 'profile_id'
      >;
      categories: Table<CategoryRow, 'slug' | 'name'>;
      locations: Table<LocationRow, 'slug' | 'name'>;
      tags: Table<TagRow, 'slug' | 'name'>;
      media: Table<MediaRow, 'storage_key' | 'mime_type' | 'size_bytes'>;
      upload_tickets: Table<
        UploadTicketRow,
        'requested_by' | 'bucket' | 'storage_key' | 'mime_type' | 'max_size_bytes' | 'expires_at'
      >;
      articles: Table<ArticleRow, 'slug' | 'title' | 'author_id' | 'category_id'>;
      article_slug_history: Table<
        { slug: string; article_id: string; created_at: string },
        'slug' | 'article_id'
      >;
      article_tags: Table<
        { article_id: string; tag_id: string; position: number },
        'article_id' | 'tag_id'
      >;
      article_media: Table<ArticleMediaRow, 'article_id' | 'media_id'>;
      article_videos: Table<ArticleVideoRow, 'article_id' | 'video_id' | 'original_url'>;
      article_related: Table<
        { article_id: string; related_article_id: string; position: number; created_at: string },
        'article_id' | 'related_article_id'
      >;
      article_coauthors: Table<
        { article_id: string; profile_id: string; position: number },
        'article_id' | 'profile_id'
      >;
      article_revisions: Table<
        ArticleRevisionRow,
        'article_id' | 'version' | 'title' | 'body' | 'status'
      >;
      article_status_history: Table<ArticleStatusHistoryRow, 'article_id' | 'to_status'>;
      editor_reviews: Table<EditorReviewRow, 'article_id' | 'reviewer_id' | 'action'>;
      article_assignments: Table<ArticleAssignmentRow, 'assigned_to' | 'assigned_by' | 'brief'>;
      article_views: Table<
        {
          id: number;
          article_id: string;
          profile_id: string | null;
          visitor_hash: string | null;
          referrer_host: string | null;
          device_kind: string | null;
          country: string | null;
          read_depth: number | null;
          viewed_at: string;
        },
        'article_id'
      >;
      saved_articles: Table<
        { profile_id: string; article_id: string; created_at: string },
        'profile_id' | 'article_id'
      >;
      followed_categories: Table<
        { profile_id: string; category_id: string; created_at: string },
        'profile_id' | 'category_id'
      >;
      followed_authors: Table<
        { profile_id: string; author_id: string; created_at: string },
        'profile_id' | 'author_id'
      >;
      comments: Table<CommentRow, 'article_id' | 'profile_id' | 'body'>;
      subscription_plans: Table<SubscriptionPlanRow, 'code' | 'name' | 'amount_paise'>;
      subscriptions: Table<SubscriptionRow, 'plan_id'>;
      payments: Table<PaymentRow, 'amount_paise'>;
      invoices: Table<
        {
          id: string;
          number: string;
          subscription_id: string | null;
          payment_id: string | null;
          profile_id: string | null;
          organization_id: string | null;
          amount_paise: number;
          tax_paise: number;
          currency: string;
          period_start: string | null;
          period_end: string | null;
          issued_at: string;
          pdf_url: string | null;
          billing_snapshot: Json;
          created_at: string;
        },
        'number' | 'amount_paise'
      >;
      payment_events: Table<
        {
          id: string;
          provider: string;
          provider_event_id: string;
          event_type: string;
          payload: Json;
          signature_verified: boolean;
          processed_at: string | null;
          process_error: string | null;
          received_at: string;
        },
        'provider_event_id' | 'event_type' | 'payload'
      >;
      entitlements: Table<EntitlementRow, 'kind'>;
      content_licenses: Table<ContentLicenseRow, 'organization_id' | 'name'>;
      license_usage: Table<
        {
          id: number;
          license_id: string;
          organization_id: string;
          profile_id: string | null;
          article_id: string;
          action: string;
          ip_hash: string | null;
          user_agent: string | null;
          accessed_at: string;
        },
        'license_id' | 'organization_id' | 'article_id'
      >;
      newsletter_subscribers: Table<NewsletterSubscriberRow, 'email'>;
      newsletter_campaigns: Table<
        {
          id: string;
          kind: NewsletterKind;
          subject: string;
          preheader: string | null;
          article_ids: string[];
          scheduled_for: string | null;
          sent_at: string | null;
          recipient_count: number;
          created_by: string | null;
          provider_broadcast_id: string | null;
          created_at: string;
        },
        'kind' | 'subject'
      >;
      email_events: Table<
        {
          id: string;
          provider: string;
          provider_message_id: string | null;
          provider_event_id: string | null;
          kind: EmailEventKind;
          recipient: string;
          template: string | null;
          subject: string | null;
          payload: Json;
          occurred_at: string;
          created_at: string;
        },
        'kind' | 'recipient'
      >;
      push_subscribers: Table<PushSubscriberRow, 'provider_player_id'>;
      push_notifications: Table<
        {
          id: string;
          article_id: string | null;
          topic: PushTopic;
          heading: string;
          content: string;
          url: string | null;
          image_url: string | null;
          sent_by: string | null;
          provider_notification_id: string | null;
          recipient_count: number | null;
          sent_at: string | null;
          error: string | null;
          created_at: string;
        },
        'heading' | 'content'
      >;
      audit_logs: Table<AuditLogRow, 'action' | 'resource_type'>;
      site_settings: Table<SiteSettingsRow, 'id'>;
      homepage_sections: Table<HomepageSectionRow, 'key' | 'title'>;
      notifications: Table<NotificationRow, 'profile_id' | 'kind' | 'title'>;
    };
    Views: {
      article_previews: View<ArticlePreviewRow>;
      author_profiles: View<AuthorProfileRow>;
      trending_articles: View<TrendingArticleRow>;
    };
    Functions: {
      record_article_view: {
        Args: {
          p_article_id: string;
          p_visitor_hash?: string | null;
          p_referrer_host?: string | null;
          p_device_kind?: string | null;
          p_read_depth?: number | null;
        };
        Returns: undefined;
      };
      search_articles: {
        Args: {
          p_query: string;
          p_category_slug?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          slug: string;
          title: string;
          title_te: string | null;
          excerpt: string | null;
          published_at: string;
          category_slug: string;
          category_name: string;
          author_name: string;
          featured_image_key: string | null;
          featured_image_alt: string | null;
          reading_time_minutes: number;
          is_premium: boolean;
          rank: number;
          total_count: number;
        }[];
      };
      subscribe_to_newsletter: {
        Args: {
          p_email: string;
          p_kinds?: NewsletterKind[];
          p_language?: ContentLanguage;
          p_source?: string;
        };
        Returns: string;
      };
      submit_article: {
        Args: { p_article_id: string; p_note?: string | null };
        Returns: ArticleStatus;
      };
      review_article: {
        Args: { p_article_id: string; p_action: ReviewAction; p_comment?: string | null };
        Returns: ArticleStatus;
      };
      publish_article: {
        Args: { p_article_id: string; p_scheduled_for?: string | null };
        Returns: ArticleStatus;
      };
      publish_due_articles: {
        Args: Record<string, never>;
        Returns: { id: string; slug: string; category_slug: string }[];
      };
      consume_license: {
        Args: { p_license_id: string; p_article_id: string; p_action?: string };
        Returns: boolean;
      };
      has_entitlement: { Args: { p_kind: EntitlementKind }; Returns: boolean };
      refresh_trending: { Args: Record<string, never>; Returns: undefined };
      refresh_article_stats: { Args: { p_since?: string }; Returns: number };
      write_audit_log: {
        Args: {
          p_action: string;
          p_resource_type: string;
          p_resource_id?: string | null;
          p_metadata?: Json;
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      article_status: ArticleStatus;
      review_action: ReviewAction;
      media_kind: MediaKind;
      video_provider: VideoProvider;
      subscription_status: SubscriptionStatus;
      plan_interval: PlanInterval;
      plan_audience: PlanAudience;
      payment_status: PaymentStatus;
      entitlement_kind: EntitlementKind;
      newsletter_kind: NewsletterKind;
      email_event_kind: EmailEventKind;
      push_topic: PushTopic;
      content_language: ContentLanguage;
    };
    CompositeTypes: Record<string, never>;
  };
};

// Convenience aliases used across the workspace.
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
