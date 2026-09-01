-- =============================================================================
-- BCM10 News — 0200 taxonomy: categories, locations, tags
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories — one level of nesting (section → sub-section). The public URL is
-- always /{slug}; slugs are globally unique so a category can be re-parented
-- without breaking links.
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,

  slug text not null unique,
  name text not null,
  name_te text,
  description text,

  -- Presentation
  position int not null default 100,
  color text,
  icon text,
  show_in_nav boolean not null default true,
  show_on_homepage boolean not null default true,
  is_active boolean not null default true,

  -- SEO
  seo_title text,
  seo_description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id),
  constraint categories_color_hex check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

create index categories_parent_idx on public.categories (parent_id);
create index categories_nav_idx on public.categories (position) where is_active and show_in_nav;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Reject a second level of nesting. Deeper trees make breadcrumbs and cache
-- invalidation ambiguous, and the newsroom has never needed one.
create or replace function public.enforce_category_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent_id into v_grandparent from public.categories where id = new.parent_id;

  if v_grandparent is not null then
    raise exception 'categories support at most two levels (got a third under %)', new.parent_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger categories_enforce_depth
  before insert or update of parent_id on public.categories
  for each row execute function public.enforce_category_depth();

-- -----------------------------------------------------------------------------
-- locations — datelines. state → district → city.
-- -----------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid references public.locations (id) on delete set null,

  slug text not null unique,
  name text not null,
  name_te text,
  kind text not null default 'city',

  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint locations_kind_allowed check (kind in ('country', 'state', 'district', 'city', 'mandal')),
  constraint locations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index locations_parent_idx on public.locations (parent_id);
create index locations_name_trgm_idx on public.locations using gin (name extensions.gin_trgm_ops);

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tags
-- -----------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_te text,
  description text,
  usage_count int not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tags_slug_format check (slug ~ '^[a-z0-9ఀ-౿]+(-[a-z0-9ఀ-౿]+)*$')
);

create index tags_usage_idx on public.tags (usage_count desc);
create index tags_name_trgm_idx on public.tags using gin (name extensions.gin_trgm_ops);

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();
