-- =============================================================================
-- BCM10 News — 0000 extensions, schemas and the domain type system
-- =============================================================================
-- Everything downstream depends on these enums. Enum values are part of the
-- public contract of the API, so they are written in snake_case and are never
-- renamed once shipped (add new values, deprecate old ones in application code).
-- =============================================================================

create schema if not exists extensions;

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "unaccent" with schema extensions;
create extension if not exists "btree_gin" with schema extensions;

-- Private schema for helper routines that must never be exposed over PostgREST.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Roles held by a profile. Ordered loosely by privilege, but privilege is
-- resolved through role_rank() rather than enum ordinality.
-- -----------------------------------------------------------------------------
create type public.user_role as enum (
  'super_admin',
  'managing_editor',
  'editor',
  'reporter',
  'photographer',
  'subscription_manager',
  'business_customer',
  'reader'
);

-- -----------------------------------------------------------------------------
-- Editorial state machine. Transitions are enforced by a trigger, not by the
-- application, so an out-of-band UPDATE cannot skip review.
-- -----------------------------------------------------------------------------
create type public.article_status as enum (
  'draft',
  'submitted',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'archived'
);

create type public.review_action as enum (
  'submitted',
  'claimed',
  'approved',
  'changes_requested',
  'rejected',
  'published',
  'scheduled',
  'unpublished',
  'archived',
  'restored'
);

create type public.media_kind as enum ('image', 'document', 'audio', 'avatar');

create type public.video_provider as enum ('youtube');

create type public.subscription_status as enum (
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired'
);

create type public.plan_interval as enum ('one_time', 'monthly', 'quarterly', 'annual');

create type public.plan_audience as enum ('reader', 'business');

create type public.payment_status as enum (
  'created',
  'authorized',
  'captured',
  'refunded',
  'partially_refunded',
  'failed'
);

create type public.entitlement_kind as enum (
  'premium_content',
  'ad_light',
  'newsletter_premium',
  'content_license',
  'api_access'
);

create type public.newsletter_kind as enum (
  'daily_digest',
  'morning_briefing',
  'evening_briefing',
  'breaking_news',
  'category_digest',
  'weekly_roundup'
);

create type public.email_event_kind as enum (
  'queued',
  'sent',
  'delivered',
  'delivery_delayed',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed'
);

create type public.push_topic as enum (
  'breaking_news',
  'politics',
  'sports',
  'cinema',
  'business',
  'technology',
  'andhra_pradesh',
  'telangana',
  'national',
  'international'
);

create type public.content_language as enum ('te', 'en');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest without trusting the client.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'BEFORE UPDATE trigger. Stamps updated_at server-side; client-supplied values are ignored.';

-- -----------------------------------------------------------------------------
-- Slug helper. Transliteration-safe for Telugu: non-ASCII is preserved because
-- Telugu slugs are legitimate in URLs, but whitespace and punctuation collapse.
-- -----------------------------------------------------------------------------
create or replace function public.slugify(input text)
returns text
language sql
immutable
strict
as $$
  select trim(
    both '-' from
    regexp_replace(
      regexp_replace(
        -- ZWNJ/ZWJ (U+200C, U+200D) shape Telugu ligatures and sit *inside*
        -- words. They are stripped, not hyphenated: they are invisible, so two
        -- slugs differing only by a joiner would look identical to a reader.
        regexp_replace(lower(input), '[‌‍]', '', 'g'),
        '[^a-z0-9ఀ-౿]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

comment on function public.slugify is
  'Lowercases and hyphenates. Preserves the Telugu block (U+0C00-U+0C7F), strips zero-width joiners. Mirrors slugify() in @bcm10/validation.';
