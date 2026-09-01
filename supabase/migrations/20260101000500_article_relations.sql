-- =============================================================================
-- BCM10 News — 0500 article relations: tags, media, videos, related stories
-- =============================================================================

-- -----------------------------------------------------------------------------
-- article_tags
-- -----------------------------------------------------------------------------
create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  position int not null default 0,
  primary key (article_id, tag_id)
);

create index article_tags_tag_idx on public.article_tags (tag_id);

-- Keep tags.usage_count in step so the tag cloud does not need a COUNT(*).
create or replace function public.sync_tag_usage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.tags set usage_count = usage_count + 1 where id = new.tag_id;
  elsif tg_op = 'DELETE' then
    update public.tags set usage_count = greatest(0, usage_count - 1) where id = old.tag_id;
  end if;
  return null;
end;
$$;

create trigger article_tags_sync_usage
  after insert or delete on public.article_tags
  for each row execute function public.sync_tag_usage();

-- -----------------------------------------------------------------------------
-- article_media — images attached to a story beyond the featured image
-- (galleries, inline figures). Inline body images also carry a media id inside
-- the Tiptap JSON; this table is what the media library reads for usage counts.
-- -----------------------------------------------------------------------------
create table public.article_media (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete restrict,
  role text not null default 'gallery',
  caption text,
  caption_te text,
  position int not null default 0,
  created_at timestamptz not null default now(),

  constraint article_media_role_allowed check (role in ('featured', 'gallery', 'inline', 'og')),
  constraint article_media_unique unique (article_id, media_id, role)
);

create index article_media_article_idx on public.article_media (article_id, position);
create index article_media_media_idx on public.article_media (media_id);

create or replace function public.sync_media_usage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.media set usage_count = usage_count + 1 where id = new.media_id;
  elsif tg_op = 'DELETE' then
    update public.media set usage_count = greatest(0, usage_count - 1) where id = old.media_id;
  end if;
  return null;
end;
$$;

create trigger article_media_sync_usage
  after insert or delete on public.article_media
  for each row execute function public.sync_media_usage();

-- -----------------------------------------------------------------------------
-- article_videos — YouTube only for now, but modelled by provider so a second
-- provider does not require a migration of the article page.
-- -----------------------------------------------------------------------------
create table public.article_videos (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,

  provider public.video_provider not null default 'youtube',
  video_id text not null,
  original_url text not null,
  is_short boolean not null default false,

  title text,
  caption text,
  caption_te text,
  thumbnail_url text,
  duration_seconds int,
  position int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A YouTube id is 11 chars of [A-Za-z0-9_-]. Validating here means a
  -- malformed id can never reach an iframe src.
  constraint article_videos_youtube_id_format check (
    provider <> 'youtube' or video_id ~ '^[A-Za-z0-9_-]{11}$'
  ),
  constraint article_videos_unique unique (article_id, provider, video_id)
);

create index article_videos_article_idx on public.article_videos (article_id, position);

create trigger article_videos_set_updated_at
  before update on public.article_videos
  for each row execute function public.set_updated_at();

alter table public.articles
  add constraint articles_featured_video_fk
  foreign key (featured_video_id) references public.article_videos (id) on delete set null;

-- -----------------------------------------------------------------------------
-- article_related — editor-curated "read next". Automatic recommendations are
-- computed separately; this table always wins over them.
-- -----------------------------------------------------------------------------
create table public.article_related (
  article_id uuid not null references public.articles (id) on delete cascade,
  related_article_id uuid not null references public.articles (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),

  primary key (article_id, related_article_id),
  constraint article_related_not_self check (article_id <> related_article_id)
);

create index article_related_target_idx on public.article_related (related_article_id);

-- -----------------------------------------------------------------------------
-- article_coauthors — a story can carry more than one byline.
-- -----------------------------------------------------------------------------
create table public.article_coauthors (
  article_id uuid not null references public.articles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  position int not null default 0,
  primary key (article_id, profile_id)
);

create index article_coauthors_profile_idx on public.article_coauthors (profile_id);
