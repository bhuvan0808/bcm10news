-- =============================================================================
-- BCM10 News — 0100 identity: profiles, newsroom permissions, organizations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — one row per auth.users row, created by trigger so a profile can
-- never be missing for a signed-in user.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  email text not null,
  full_name text not null default '',
  display_name text,
  display_name_te text,
  slug text unique,

  role public.user_role not null default 'reader',
  is_active boolean not null default true,

  -- Explicit newsroom grants layered on top of the role. A reporter with
  -- can_publish = true may publish directly; the default is false.
  can_publish boolean not null default false,
  can_send_push boolean not null default false,
  can_manage_media_library boolean not null default false,

  avatar_media_id uuid,
  bio text,
  bio_te text,
  designation text,
  phone text,
  social_links jsonb not null default '{}'::jsonb,

  -- Reader preferences
  preferred_language public.content_language not null default 'te',
  timezone text not null default 'Asia/Kolkata',

  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_format check (position('@' in email) > 1),
  constraint profiles_social_links_is_object check (jsonb_typeof(social_links) = 'object')
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_slug_idx on public.profiles (slug) where slug is not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is
  'Application-level user record. Mirrors auth.users 1:1; role and permission flags drive every RLS policy.';
comment on column public.profiles.can_publish is
  'Explicit grant that lets a reporter bypass editor review. Editors and above publish by role.';

-- -----------------------------------------------------------------------------
-- Provision a profile whenever Supabase Auth creates a user. Runs as SECURITY
-- DEFINER because auth triggers execute as the auth admin role.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_avatar text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
  v_avatar := new.raw_user_meta_data ->> 'avatar_url';

  insert into public.profiles (id, email, full_name, social_links)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    case when v_avatar is null then '{}'::jsonb else jsonb_build_object('avatar_url', v_avatar) end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile email in step with an email change in Supabase Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Authorization helpers.
--
-- These are SECURITY DEFINER with an empty search_path and are the ONLY way
-- policies should read a caller's role. Reading public.profiles directly from
-- inside a profiles policy would recurse.
-- -----------------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function public.role_rank(r public.user_role)
returns int
language sql
immutable
as $$
  select case r
    when 'super_admin' then 100
    when 'managing_editor' then 80
    when 'editor' then 60
    when 'subscription_manager' then 40
    when 'reporter' then 30
    when 'photographer' then 20
    when 'business_customer' then 10
    when 'reader' then 0
  end;
$$;

comment on function public.role_rank is
  'Numeric privilege weight. Compare ranks instead of enum ordinality so roles can be reordered safely.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_name() = 'super_admin', false);
$$;

-- Editor and above: may review, edit others' work and publish.
create or replace function public.is_editorial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.role_rank(public.current_role_name()) >= 60, false);
$$;

-- Anyone who works in the newsroom, including photographers.
create or replace function public.is_newsroom()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_name() in (
    'super_admin', 'managing_editor', 'editor', 'reporter', 'photographer'
  ), false);
$$;

create or replace function public.can_publish()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.can_publish or public.role_rank(p.role) >= 60
     from public.profiles p
     where p.id = (select auth.uid()) and p.is_active),
    false
  );
$$;

create or replace function public.manages_subscriptions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_name() in ('super_admin', 'subscription_manager'), false);
$$;

-- -----------------------------------------------------------------------------
-- organizations — B2B licensing customers.
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  gstin text,
  billing_email text not null,
  billing_address jsonb not null default '{}'::jsonb,
  contact_phone text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organizations_name_len check (char_length(name) between 2 and 200)
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index organization_members_profile_idx on public.organization_members (profile_id);

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.profile_id = (select auth.uid())
  );
$$;
