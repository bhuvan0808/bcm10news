-- =============================================================================
-- BCM10 News — 0900 B2B licensing, newsletter, push, email events
-- =============================================================================

-- -----------------------------------------------------------------------------
-- content_licenses — a purchased right to use BCM10 content, held by an org.
-- -----------------------------------------------------------------------------
create table public.content_licenses (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,

  name text not null,
  -- NULL quota = unlimited plan.
  quota_per_period int,
  used_this_period int not null default 0,
  period_start timestamptz not null default now(),
  period_end timestamptz,

  allow_full_text boolean not null default true,
  allow_images boolean not null default false,
  allow_republish boolean not null default false,
  allow_api boolean not null default false,
  -- Empty array means every category is in scope.
  allowed_category_ids uuid[] not null default '{}',

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint content_licenses_quota_positive check (quota_per_period is null or quota_per_period > 0),
  constraint content_licenses_usage_nonneg check (used_this_period >= 0)
);

create index content_licenses_org_idx on public.content_licenses (organization_id) where is_active;

create trigger content_licenses_set_updated_at
  before update on public.content_licenses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- license_usage — append-only ledger. One row per licensed access.
-- -----------------------------------------------------------------------------
create table public.license_usage (
  id bigserial primary key,
  license_id uuid not null references public.content_licenses (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  article_id uuid not null references public.articles (id) on delete cascade,

  action text not null default 'view',
  ip_hash text,
  user_agent text,
  accessed_at timestamptz not null default now(),

  constraint license_usage_action_allowed check (action in ('view', 'download', 'api', 'republish'))
);

create index license_usage_license_time_idx on public.license_usage (license_id, accessed_at desc);
create index license_usage_org_time_idx on public.license_usage (organization_id, accessed_at desc);
create index license_usage_article_idx on public.license_usage (article_id);

-- Claim one unit of quota and record the access, atomically. Returns false when
-- the licence is exhausted so the caller can respond 402 instead of serving.
create or replace function public.consume_license(
  p_license_id uuid,
  p_article_id uuid,
  p_action text default 'view'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_license public.content_licenses;
begin
  select * into v_license
  from public.content_licenses
  where id = p_license_id and is_active
  for update;

  if not found then
    return false;
  end if;

  if not public.is_org_member(v_license.organization_id) and not public.is_admin() then
    raise exception 'not a member of the licensing organization' using errcode = '42501';
  end if;

  if v_license.period_end is not null and v_license.period_end < now() then
    return false;
  end if;

  if v_license.quota_per_period is not null
     and v_license.used_this_period >= v_license.quota_per_period then
    return false;
  end if;

  -- Re-reading the same article inside a period does not spend a second unit.
  if not exists (
    select 1 from public.license_usage
    where license_id = p_license_id
      and article_id = p_article_id
      and accessed_at >= v_license.period_start
  ) then
    update public.content_licenses
       set used_this_period = used_this_period + 1
     where id = p_license_id;
  end if;

  insert into public.license_usage (license_id, organization_id, profile_id, article_id, action)
  values (p_license_id, v_license.organization_id, (select auth.uid()), p_article_id, p_action);

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Newsletter
-- -----------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null,
  profile_id uuid references public.profiles (id) on delete set null,

  is_confirmed boolean not null default false,
  confirmed_at timestamptz,
  confirmation_token text,
  unsubscribe_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  unsubscribed_at timestamptz,

  kinds public.newsletter_kind[] not null default '{daily_digest}',
  category_ids uuid[] not null default '{}',
  language public.content_language not null default 'te',

  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint newsletter_subscribers_email_format check (position('@' in email) > 1)
);

create unique index newsletter_subscribers_email_key on public.newsletter_subscribers (lower(email));
create index newsletter_subscribers_active_idx on public.newsletter_subscribers (kinds)
  where is_confirmed and unsubscribed_at is null;

create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

create table public.newsletter_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  kind public.newsletter_kind not null,
  subject text not null,
  preheader text,
  article_ids uuid[] not null default '{}',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  provider_broadcast_id text,
  created_at timestamptz not null default now()
);

create index newsletter_campaigns_sent_idx on public.newsletter_campaigns (sent_at desc);

-- -----------------------------------------------------------------------------
-- email_events — Resend webhook landing table.
-- -----------------------------------------------------------------------------
create table public.email_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null default 'resend',
  provider_message_id text,
  provider_event_id text,
  kind public.email_event_kind not null,
  recipient text not null,
  template text,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index email_events_recipient_idx on public.email_events (lower(recipient), occurred_at desc);
create index email_events_message_idx on public.email_events (provider_message_id);
create unique index email_events_dedupe_idx on public.email_events (provider, provider_event_id)
  where provider_event_id is not null;

-- -----------------------------------------------------------------------------
-- Push
-- -----------------------------------------------------------------------------
create table public.push_subscribers (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null default 'onesignal',
  provider_player_id text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  topics public.push_topic[] not null default '{breaking_news}',
  device_kind text,
  language public.content_language not null default 'te',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscribers_provider_unique unique (provider, provider_player_id)
);

create index push_subscribers_profile_idx on public.push_subscribers (profile_id);

create trigger push_subscribers_set_updated_at
  before update on public.push_subscribers
  for each row execute function public.set_updated_at();

create table public.push_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid references public.articles (id) on delete set null,
  topic public.push_topic not null default 'breaking_news',
  heading text not null,
  content text not null,
  url text,
  image_url text,

  sent_by uuid references public.profiles (id) on delete set null,
  provider_notification_id text,
  recipient_count int,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index push_notifications_article_idx on public.push_notifications (article_id);
create index push_notifications_sent_idx on public.push_notifications (sent_at desc);
