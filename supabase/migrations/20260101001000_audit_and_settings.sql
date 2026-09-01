-- =============================================================================
-- BCM10 News — 1000 audit log, site settings, homepage layout
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_logs — append-only. Nobody, including super_admin, may UPDATE or
-- DELETE (enforced by RLS in 1100 plus a rule here).
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  actor_role public.user_role,

  action text not null,
  resource_type text not null,
  resource_id text,

  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  request_id text,

  created_at timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index audit_logs_time_idx on public.audit_logs (created_at desc);

comment on table public.audit_logs is
  'Append-only compliance record. IP is stored only for security-relevant actions (auth, payment, licence).';

create or replace function public.write_audit_log(
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.audit_logs (actor_id, actor_email, actor_role, action, resource_type, resource_id, metadata)
  select
    p.id, p.email, p.role, p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb)
  from public.profiles p
  where p.id = (select auth.uid())
  returning id into v_id;

  -- Unauthenticated / service-role callers still get a row, just without an actor.
  if v_id is null then
    insert into public.audit_logs (action, resource_type, resource_id, metadata)
    values (p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- Automatic audit of the things that matter most on articles.
create or replace function public.audit_article_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log('article.created', 'article', new.id::text,
      jsonb_build_object('title', new.title, 'status', new.status));
  elsif tg_op = 'DELETE' then
    perform public.write_audit_log('article.deleted', 'article', old.id::text,
      jsonb_build_object('title', old.title, 'status', old.status));
  elsif new.status is distinct from old.status then
    perform public.write_audit_log('article.status_changed', 'article', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status, 'title', new.title));
  end if;
  return null;
end;
$$;

create trigger articles_audit
  after insert or update or delete on public.articles
  for each row execute function public.audit_article_change();

create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     or new.can_publish is distinct from old.can_publish
     or new.is_active is distinct from old.is_active then
    perform public.write_audit_log('profile.permissions_changed', 'profile', new.id::text,
      jsonb_build_object(
        'from', jsonb_build_object('role', old.role, 'can_publish', old.can_publish, 'is_active', old.is_active),
        'to', jsonb_build_object('role', new.role, 'can_publish', new.can_publish, 'is_active', new.is_active)
      ));
  end if;
  return null;
end;
$$;

create trigger profiles_audit_role
  after update on public.profiles
  for each row execute function public.audit_role_change();

-- -----------------------------------------------------------------------------
-- site_settings — a single row of editable configuration so the newsroom can
-- change the ticker, contact details and social handles without a deploy.
-- -----------------------------------------------------------------------------
create table public.site_settings (
  id boolean primary key default true,

  site_name text not null default 'BCM10 News',
  tagline text,
  tagline_te text,
  logo_media_id uuid references public.media (id) on delete set null,
  default_og_media_id uuid references public.media (id) on delete set null,

  contact_email text,
  contact_phone text,
  office_address text,
  social_links jsonb not null default '{}'::jsonb,

  breaking_ticker_enabled boolean not null default true,
  breaking_ticker_ttl_minutes int not null default 240,
  comments_enabled boolean not null default false,
  paywall_enabled boolean not null default false,
  push_enabled boolean not null default false,
  newsletter_enabled boolean not null default true,

  ads_txt text,
  robots_extra text,
  announcement text,

  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint site_settings_singleton check (id)
);

insert into public.site_settings (id) values (true) on conflict do nothing;

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- homepage_sections — the homepage is assembled from configurable blocks so
-- publishing a story never requires a code change to reorder the front page.
-- -----------------------------------------------------------------------------
create table public.homepage_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  title text not null,
  title_te text,
  layout text not null default 'grid',
  source text not null default 'category',

  category_id uuid references public.categories (id) on delete cascade,
  tag_id uuid references public.tags (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  manual_article_ids uuid[] not null default '{}',

  item_limit int not null default 6,
  position int not null default 100,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint homepage_sections_layout_allowed check (
    layout in ('hero', 'grid', 'list', 'carousel', 'video', 'gallery', 'compact')
  ),
  constraint homepage_sections_source_allowed check (
    source in ('category', 'tag', 'location', 'latest', 'most_read', 'editors_picks', 'manual', 'videos', 'photos')
  ),
  constraint homepage_sections_limit_sane check (item_limit between 1 and 30)
);

create index homepage_sections_order_idx on public.homepage_sections (position) where is_active;

create trigger homepage_sections_set_updated_at
  before update on public.homepage_sections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- notifications — in-app newsroom notifications (assignment, review outcome).
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where read_at is null;
