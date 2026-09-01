-- =============================================================================
-- BCM10 News — 0700 reader engagement
-- =============================================================================

-- -----------------------------------------------------------------------------
-- article_views — append-only. PostHog owns product analytics; this table
-- exists so "most read" can be computed without a round trip to a vendor and
-- so B2B usage reporting has a first-party source.
-- -----------------------------------------------------------------------------
create table public.article_views (
  id bigserial primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  -- Salted daily hash of IP + UA. Never the raw address.
  visitor_hash text,
  referrer_host text,
  device_kind text,
  country text,
  read_depth int,
  viewed_at timestamptz not null default now(),

  constraint article_views_depth_range check (read_depth is null or read_depth between 0 and 100)
);

create index article_views_article_time_idx on public.article_views (article_id, viewed_at desc);
create index article_views_time_idx on public.article_views (viewed_at desc);
create index article_views_profile_idx on public.article_views (profile_id, viewed_at desc)
  where profile_id is not null;

-- Rolling counters. A trigger per view row would serialise writes on hot
-- stories, so the counter is advanced in batches by refresh_article_stats().
create or replace function public.refresh_article_stats(p_since interval default interval '24 hours')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated int;
begin
  with counts as (
    select article_id, count(*) as n
    from public.article_views
    where viewed_at >= now() - p_since
    group by article_id
  )
  update public.articles a
     set view_count = a.view_count + c.n
    from counts c
   where a.id = c.article_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- -----------------------------------------------------------------------------
-- saved_articles / follows
-- -----------------------------------------------------------------------------
create table public.saved_articles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, article_id)
);

create index saved_articles_recent_idx on public.saved_articles (profile_id, created_at desc);

create table public.followed_categories (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, category_id)
);

create table public.followed_authors (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, author_id),
  constraint followed_authors_not_self check (profile_id <> author_id)
);

-- -----------------------------------------------------------------------------
-- comments — moderated by default. Threaded one level deep.
-- -----------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  body text not null,
  is_approved boolean not null default false,
  is_flagged boolean not null default false,
  flagged_reason text,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint comments_body_len check (char_length(btrim(body)) between 1 and 4000)
);

create index comments_article_idx on public.comments (article_id, created_at desc) where is_approved;
create index comments_moderation_queue_idx on public.comments (created_at) where not is_approved and not is_flagged;
create index comments_parent_idx on public.comments (parent_id);

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create or replace function public.sync_comment_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.is_approved then
    update public.articles set comment_count = comment_count + 1 where id = new.article_id;
  elsif tg_op = 'DELETE' and old.is_approved then
    update public.articles set comment_count = greatest(0, comment_count - 1) where id = old.article_id;
  elsif tg_op = 'UPDATE' and new.is_approved is distinct from old.is_approved then
    update public.articles
       set comment_count = greatest(0, comment_count + case when new.is_approved then 1 else -1 end)
     where id = new.article_id;
  end if;
  return null;
end;
$$;

create trigger comments_sync_count
  after insert or update of is_approved or delete on public.comments
  for each row execute function public.sync_comment_count();
