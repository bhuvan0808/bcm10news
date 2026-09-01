-- =============================================================================
-- BCM10 News — 0600 newsroom workflow: revisions, transitions, assignments
-- =============================================================================

-- -----------------------------------------------------------------------------
-- article_revisions — an immutable snapshot per meaningful save. This is the
-- journalistic record: who wrote what, who changed it, and when.
-- -----------------------------------------------------------------------------
create table public.article_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  version int not null,

  title text not null,
  title_te text,
  subtitle text,
  excerpt text,
  body jsonb not null,
  body_text text not null default '',

  status public.article_status not null,
  is_published_version boolean not null default false,

  created_by uuid references public.profiles (id) on delete set null,
  change_summary text,
  created_at timestamptz not null default now(),

  constraint article_revisions_version_unique unique (article_id, version),
  constraint article_revisions_version_positive check (version > 0)
);

create index article_revisions_article_idx on public.article_revisions (article_id, version desc);
create unique index article_revisions_published_idx on public.article_revisions (article_id)
  where is_published_version;

comment on table public.article_revisions is
  'Append-only. Rows are never updated or deleted except by cascade when the article is deleted.';

-- -----------------------------------------------------------------------------
-- article_status_history — the audit trail of the state machine.
-- -----------------------------------------------------------------------------
create table public.article_status_history (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  from_status public.article_status,
  to_status public.article_status not null,
  action public.review_action,
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index article_status_history_article_idx on public.article_status_history (article_id, created_at desc);
create index article_status_history_actor_idx on public.article_status_history (actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- editor_reviews — reviewer feedback threads attached to a submission.
-- -----------------------------------------------------------------------------
create table public.editor_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  action public.review_action not null,
  comment text,
  -- Optional anchor into the document so feedback can point at a paragraph.
  anchor jsonb,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index editor_reviews_article_idx on public.editor_reviews (article_id, created_at desc);
create index editor_reviews_open_idx on public.editor_reviews (article_id) where resolved_at is null;

-- -----------------------------------------------------------------------------
-- article_assignments — desk gives a reporter a story to file.
-- -----------------------------------------------------------------------------
create table public.article_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid references public.articles (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete cascade,

  brief text not null,
  category_id uuid references public.categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  due_at timestamptz,
  priority int not null default 0,
  accepted_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index article_assignments_assignee_idx on public.article_assignments (assigned_to, due_at)
  where completed_at is null;
create index article_assignments_article_idx on public.article_assignments (article_id);

create trigger article_assignments_set_updated_at
  before update on public.article_assignments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- The state machine
-- =============================================================================
-- Legal transitions. Anything not listed here is rejected, including the
-- tempting draft → published shortcut.
-- -----------------------------------------------------------------------------
create or replace function public.is_legal_transition(
  p_from public.article_status,
  p_to public.article_status
)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('draft', 'draft'),
    ('draft', 'submitted'),
    ('draft', 'archived'),

    ('submitted', 'in_review'),
    ('submitted', 'changes_requested'),
    ('submitted', 'approved'),
    ('submitted', 'draft'),            -- reporter retracts before pickup
    ('submitted', 'archived'),

    ('in_review', 'changes_requested'),
    ('in_review', 'approved'),
    ('in_review', 'submitted'),        -- reviewer releases the claim
    ('in_review', 'archived'),

    ('changes_requested', 'draft'),
    ('changes_requested', 'submitted'),
    ('changes_requested', 'archived'),

    ('approved', 'scheduled'),
    ('approved', 'published'),
    ('approved', 'changes_requested'),
    ('approved', 'archived'),

    ('scheduled', 'published'),
    ('scheduled', 'approved'),         -- unschedule
    ('scheduled', 'changes_requested'),
    ('scheduled', 'archived'),

    ('published', 'published'),        -- edit in place
    ('published', 'archived'),
    ('published', 'draft'),            -- takedown back to the desk

    ('archived', 'draft'),
    ('archived', 'published')          -- restore
  );
$$;

comment on function public.is_legal_transition is
  'Single source of truth for the editorial state machine. The admin UI mirrors this list but the database is authoritative.';

-- -----------------------------------------------------------------------------
-- Transition guard. Runs BEFORE UPDATE on articles.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_article_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    -- Not a transition, but keep publish bookkeeping consistent on in-place edits.
    if new.status = 'published' and new.published_at is null then
      new.published_at := coalesce(old.published_at, now());
    end if;
    return new;
  end if;

  if not public.is_legal_transition(old.status, new.status) then
    raise exception 'illegal article transition: % -> %', old.status, new.status
      using errcode = 'check_violation',
            hint = 'Allowed transitions are defined by public.is_legal_transition().';
  end if;

  -- Publishing bookkeeping.
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
    new.first_published_at := coalesce(old.first_published_at, new.published_at);
    new.scheduled_for := null;
    new.unpublished_at := null;
  end if;

  if old.status = 'published' and new.status <> 'published' then
    new.unpublished_at := now();
  end if;

  if new.status = 'scheduled' and new.scheduled_for is null then
    raise exception 'scheduled articles require scheduled_for'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger articles_enforce_transition
  before update of status on public.articles
  for each row execute function public.enforce_article_transition();

-- -----------------------------------------------------------------------------
-- Audit every transition, including the initial insert.
-- -----------------------------------------------------------------------------
create or replace function public.log_article_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.article_status_history (article_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, coalesce((select auth.uid()), new.author_id));
  elsif new.status is distinct from old.status then
    insert into public.article_status_history (article_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger articles_log_transition
  after insert or update of status on public.articles
  for each row execute function public.log_article_transition();

-- -----------------------------------------------------------------------------
-- Snapshot a revision on publish, and whenever the body materially changes.
-- -----------------------------------------------------------------------------
create or replace function public.snapshot_article_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
  v_body_changed boolean;
  v_published boolean;
begin
  v_body_changed := tg_op = 'INSERT'
    or new.body is distinct from old.body
    or new.title is distinct from old.title
    or new.subtitle is distinct from old.subtitle;

  v_published := new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published');

  if not v_body_changed and not v_published then
    return null;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.article_revisions where article_id = new.id;

  if new.status = 'published' then
    update public.article_revisions
      set is_published_version = false
      where article_id = new.id and is_published_version;
  end if;

  insert into public.article_revisions (
    article_id, version, title, title_te, subtitle, excerpt,
    body, body_text, status, is_published_version, created_by
  )
  values (
    new.id, v_version, new.title, new.title_te, new.subtitle, new.excerpt,
    new.body, new.body_text, new.status, new.status = 'published', (select auth.uid())
  );

  return null;
end;
$$;

create trigger articles_snapshot_revision
  after insert or update on public.articles
  for each row execute function public.snapshot_article_revision();

-- -----------------------------------------------------------------------------
-- Media visibility follows publication. Once an asset has appeared on a
-- published story it stays public, because CDN copies of it already exist.
-- -----------------------------------------------------------------------------
create or replace function public.sync_media_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return null;
  end if;

  update public.media m
     set is_public = true
   where not m.is_public
     and (
       m.id = new.featured_image_id
       or m.id = new.og_image_id
       or m.id in (select am.media_id from public.article_media am where am.article_id = new.id)
       -- Images embedded in the body carry their media id on the node attrs.
       or m.id::text in (
         select t #>> '{}'
         from jsonb_path_query(new.body, '$.**.attrs.mediaId') as t
         where jsonb_typeof(t) = 'string'
       )
     );

  return null;
end;
$$;

create trigger articles_sync_media_visibility
  after insert or update of status, body, featured_image_id, og_image_id on public.articles
  for each row execute function public.sync_media_visibility();
