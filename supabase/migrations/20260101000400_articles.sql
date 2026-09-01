-- =============================================================================
-- BCM10 News — 0400 articles
-- =============================================================================
-- The body is stored as structured ProseMirror/Tiptap JSON, never as an HTML
-- blob. HTML is rendered at read time from that tree, which keeps stored
-- content free of markup that could be replayed as XSS and makes blocks
-- (galleries, videos, callouts) addressable for later reuse.
-- =============================================================================

create table public.articles (
  id uuid primary key default extensions.gen_random_uuid(),

  -- Public identity. The slug is the URL; it is unique forever and old slugs
  -- are retained in article_slug_history so links never rot.
  slug text not null unique,

  title text not null,
  title_te text,
  subtitle text,
  excerpt text,
  language public.content_language not null default 'te',

  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- Flattened plain text, maintained by trigger. Feeds search and reading time.
  body_text text not null default '',

  -- Ownership and desk
  author_id uuid not null references public.profiles (id) on delete restrict,
  byline_override text,
  editor_id uuid references public.profiles (id) on delete set null,
  category_id uuid not null references public.categories (id) on delete restrict,
  secondary_category_id uuid references public.categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,

  -- Workflow
  status public.article_status not null default 'draft',
  published_at timestamptz,
  scheduled_for timestamptz,
  first_published_at timestamptz,
  unpublished_at timestamptz,

  -- Editorial flags
  is_breaking boolean not null default false,
  is_exclusive boolean not null default false,
  is_premium boolean not null default false,
  is_featured boolean not null default false,
  is_sponsored boolean not null default false,
  allow_comments boolean not null default true,
  allow_syndication boolean not null default true,
  priority int not null default 0,

  -- Premium gating: how much of the body a non-subscriber may read.
  preview_paragraphs int not null default 3,

  featured_image_id uuid references public.media (id) on delete set null,
  featured_video_id uuid,

  -- SEO
  seo_title text,
  seo_description text,
  canonical_url text,
  og_image_id uuid references public.media (id) on delete set null,
  noindex boolean not null default false,

  -- Denormalised counters, updated out-of-band. Never read for correctness.
  view_count bigint not null default 0,
  share_count bigint not null default 0,
  comment_count int not null default 0,
  reading_time_minutes int not null default 1,
  word_count int not null default 0,

  search_vector tsvector,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint articles_slug_format check (slug ~ '^[a-z0-9ఀ-౿]+(-[a-z0-9ఀ-౿]+)*$' and char_length(slug) between 3 and 200),
  constraint articles_title_len check (char_length(title) between 3 and 300),
  constraint articles_seo_description_len check (seo_description is null or char_length(seo_description) <= 320),
  constraint articles_body_is_doc check (body ->> 'type' = 'doc'),
  constraint articles_preview_paragraphs_sane check (preview_paragraphs between 0 and 20),
  constraint articles_published_needs_timestamp check (
    status <> 'published' or published_at is not null
  ),
  constraint articles_scheduled_needs_time check (
    status <> 'scheduled' or scheduled_for is not null
  ),
  constraint articles_distinct_categories check (
    secondary_category_id is null or secondary_category_id <> category_id
  )
);

-- --- Read paths -------------------------------------------------------------
-- The public site only ever asks for published rows ordered by published_at,
-- so every public index is partial on status = 'published'.

create index articles_public_feed_idx on public.articles (published_at desc)
  where status = 'published';

create index articles_public_category_idx on public.articles (category_id, published_at desc)
  where status = 'published';

create index articles_public_author_idx on public.articles (author_id, published_at desc)
  where status = 'published';

create index articles_public_location_idx on public.articles (location_id, published_at desc)
  where status = 'published' and location_id is not null;

create index articles_breaking_idx on public.articles (published_at desc)
  where status = 'published' and is_breaking;

create index articles_featured_idx on public.articles (priority desc, published_at desc)
  where status = 'published' and is_featured;

create index articles_premium_idx on public.articles (published_at desc)
  where status = 'published' and is_premium;

-- --- Newsroom paths ---------------------------------------------------------
create index articles_status_updated_idx on public.articles (status, updated_at desc);
create index articles_author_status_idx on public.articles (author_id, status, updated_at desc);
create index articles_editor_queue_idx on public.articles (updated_at desc)
  where status in ('submitted', 'in_review', 'changes_requested');
create index articles_scheduled_due_idx on public.articles (scheduled_for)
  where status = 'scheduled';

-- --- Search -----------------------------------------------------------------
create index articles_search_idx on public.articles using gin (search_vector);
create index articles_title_trgm_idx on public.articles using gin (title extensions.gin_trgm_ops);

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

comment on table public.articles is
  'Editorial unit of work. status transitions are validated by enforce_article_transition(); do not UPDATE status without going through it.';

-- -----------------------------------------------------------------------------
-- Slug history — every slug an article has ever had, so /news/{old-slug} can
-- 301 to the current one instead of 404ing.
-- -----------------------------------------------------------------------------
create table public.article_slug_history (
  slug text primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index article_slug_history_article_idx on public.article_slug_history (article_id);

create or replace function public.record_slug_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    insert into public.article_slug_history (slug, article_id)
    values (old.slug, new.id)
    on conflict (slug) do update set article_id = excluded.article_id;
  end if;
  return new;
end;
$$;

create trigger articles_record_slug_change
  after update of slug on public.articles
  for each row execute function public.record_slug_change();

-- -----------------------------------------------------------------------------
-- Derived text: flatten the Tiptap tree into searchable plain text and keep
-- word count / reading time honest. Doing this in the database means an import
-- script or a direct SQL fix cannot leave search stale.
-- -----------------------------------------------------------------------------
create or replace function public.extract_doc_text(doc jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_out text := '';
  v_txt text;
begin
  if doc is null then
    return '';
  end if;

  for v_txt in
    select t #>> '{}'
    from jsonb_path_query(doc, '$.**.text') as t
    where jsonb_typeof(t) = 'string'
  loop
    v_out := v_out || ' ' || v_txt;
  end loop;

  return btrim(regexp_replace(v_out, '\s+', ' ', 'g'));
end;
$$;

comment on function public.extract_doc_text is
  'Flattens every text node of a ProseMirror document into a single string.';

create or replace function public.articles_derive_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_words int;
begin
  new.body_text := public.extract_doc_text(new.body);

  -- array_length on a split is a good enough word count for both scripts;
  -- Telugu words are whitespace-delimited in practice.
  v_words := coalesce(array_length(regexp_split_to_array(btrim(new.body_text), '\s+'), 1), 0);
  new.word_count := v_words;
  -- 200 wpm is the usual newsroom figure; floor of 1 minute.
  new.reading_time_minutes := greatest(1, ceil(v_words / 200.0)::int);

  -- 'simple' indexes both scripts without stemming; 'english' adds stems for
  -- the English half of a mixed-language story. Weighted A→D by importance.
  new.search_vector :=
      setweight(to_tsvector('simple', coalesce(new.title, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(new.title_te, '')), 'A')
   || setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(new.subtitle, '')), 'B')
   || setweight(to_tsvector('simple', coalesce(new.excerpt, '')), 'B')
   || setweight(to_tsvector('simple', coalesce(new.body_text, '')), 'C')
   || setweight(to_tsvector('english', coalesce(new.body_text, '')), 'D');

  return new;
end;
$$;

create trigger articles_derive_content
  before insert or update of body, title, title_te, subtitle, excerpt on public.articles
  for each row execute function public.articles_derive_content();
