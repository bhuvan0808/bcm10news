-- =============================================================================
-- BCM10 News — 1200 public read surface: views, search, RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- article_previews
--
-- Deliberately a view owned by the migration role, so it does NOT run under the
-- caller's RLS. That is the point: a premium article's row is invisible to a
-- reader without an entitlement, yet the site still has to render its headline,
-- image and paywall. This view exposes only columns that are safe to show to
-- everyone — body and body_text are absent, and the WHERE clause restricts it
-- to published rows.
-- -----------------------------------------------------------------------------
create view public.article_previews as
select
  a.id,
  a.slug,
  a.title,
  a.title_te,
  a.subtitle,
  a.excerpt,
  a.language,
  a.author_id,
  a.byline_override,
  a.category_id,
  a.secondary_category_id,
  a.location_id,
  a.published_at,
  a.updated_at,
  a.first_published_at,
  a.is_breaking,
  a.is_exclusive,
  a.is_premium,
  a.is_featured,
  a.is_sponsored,
  a.priority,
  a.reading_time_minutes,
  a.word_count,
  a.view_count,
  a.comment_count,
  a.share_count,
  a.featured_image_id,
  a.seo_title,
  a.seo_description,
  a.canonical_url,
  a.noindex,
  c.slug as category_slug,
  c.name as category_name,
  c.name_te as category_name_te,
  l.slug as location_slug,
  l.name as location_name,
  l.name_te as location_name_te,
  p.slug as author_slug,
  coalesce(p.display_name, p.full_name) as author_name,
  p.display_name_te as author_name_te,
  m.storage_key as featured_image_key,
  m.alt_text as featured_image_alt,
  m.alt_text_te as featured_image_alt_te,
  m.caption as featured_image_caption,
  m.credit as featured_image_credit,
  m.width as featured_image_width,
  m.height as featured_image_height,
  m.blur_data_url as featured_image_blur,
  m.variants as featured_image_variants
from public.articles a
join public.categories c on c.id = a.category_id
join public.profiles p on p.id = a.author_id
left join public.locations l on l.id = a.location_id
left join public.media m on m.id = a.featured_image_id
where a.status = 'published'
  and a.published_at <= now();

comment on view public.article_previews is
  'Safe, public projection of published articles. Contains no article body — the paywall depends on that.';

grant select on public.article_previews to anon, authenticated;

-- -----------------------------------------------------------------------------
-- author_profiles — public byline data only. The profiles table itself is not
-- readable by anon.
-- -----------------------------------------------------------------------------
create view public.author_profiles as
select
  p.id,
  p.slug,
  coalesce(p.display_name, p.full_name) as name,
  p.display_name_te as name_te,
  p.bio,
  p.bio_te,
  p.designation,
  p.social_links,
  p.role,
  m.storage_key as avatar_key,
  (select count(*) from public.articles a where a.author_id = p.id and a.status = 'published') as article_count
from public.profiles p
left join public.media m on m.id = p.avatar_media_id
where p.is_active
  and p.slug is not null
  and p.role in ('super_admin', 'managing_editor', 'editor', 'reporter', 'photographer');

grant select on public.author_profiles to anon, authenticated;

-- -----------------------------------------------------------------------------
-- trending_articles — "most read" without scanning article_views on every
-- homepage request. Refreshed by the /api/cron/refresh-trending job.
-- -----------------------------------------------------------------------------
create materialized view public.trending_articles as
select
  v.article_id,
  count(*) as views_24h,
  count(*) filter (where v.viewed_at >= now() - interval '1 hour') as views_1h,
  max(v.viewed_at) as last_viewed_at
from public.article_views v
join public.articles a on a.id = v.article_id and a.status = 'published'
where v.viewed_at >= now() - interval '24 hours'
group by v.article_id;

create unique index trending_articles_pk on public.trending_articles (article_id);
create index trending_articles_rank_idx on public.trending_articles (views_24h desc);

grant select on public.trending_articles to anon, authenticated;

create or replace function public.refresh_trending()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.trending_articles;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_article_view — the only way a view row is written. SECURITY DEFINER so
-- article_views needs no INSERT policy, and the visitor hash is computed here
-- rather than trusted from the client.
-- -----------------------------------------------------------------------------
create or replace function public.record_article_view(
  p_article_id uuid,
  p_visitor_hash text default null,
  p_referrer_host text default null,
  p_device_kind text default null,
  p_read_depth int default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.status = 'published'
  ) then
    return;
  end if;

  insert into public.article_views (
    article_id, profile_id, visitor_hash, referrer_host, device_kind, read_depth
  )
  values (
    p_article_id,
    (select auth.uid()),
    left(coalesce(p_visitor_hash, ''), 64),
    left(coalesce(p_referrer_host, ''), 128),
    left(coalesce(p_device_kind, ''), 32),
    p_read_depth
  );
end;
$$;

grant execute on function public.record_article_view(uuid, text, text, text, int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- search_articles — Postgres full-text over the weighted vector, with a trigram
-- fallback so a misspelt English headline still matches. Telugu is indexed with
-- the 'simple' configuration (no stemmer exists for it), which behaves as exact
-- token matching; that is adequate until a dedicated engine is introduced.
-- -----------------------------------------------------------------------------
create or replace function public.search_articles(
  p_query text,
  p_category_slug text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  title_te text,
  excerpt text,
  published_at timestamptz,
  category_slug text,
  category_name text,
  author_name text,
  featured_image_key text,
  featured_image_alt text,
  reading_time_minutes int,
  is_premium boolean,
  rank real,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select
      websearch_to_tsquery('simple', p_query) as ts_simple,
      websearch_to_tsquery('english', p_query) as ts_english,
      btrim(p_query) as raw
  ),
  matched as (
    select
      p.*,
      greatest(
        ts_rank(a.search_vector, q.ts_simple),
        ts_rank(a.search_vector, q.ts_english),
        extensions.similarity(p.title, q.raw) * 0.5
      ) as rank
    from public.article_previews p
    join public.articles a on a.id = p.id
    cross join q
    where (
        a.search_vector @@ q.ts_simple
        or a.search_vector @@ q.ts_english
        -- Schema-qualified: this function runs with an empty search_path.
        or p.title operator(extensions.%) q.raw
      )
      and (p_category_slug is null or p.category_slug = p_category_slug)
  ),
  counted as (
    select count(*) as n from matched
  )
  select
    m.id, m.slug, m.title, m.title_te, m.excerpt, m.published_at,
    m.category_slug, m.category_name, m.author_name,
    m.featured_image_key, m.featured_image_alt,
    m.reading_time_minutes, m.is_premium,
    m.rank::real,
    counted.n
  from matched m, counted
  order by m.rank desc, m.published_at desc
  limit least(coalesce(p_limit, 20), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_articles(text, text, int, int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- newsletter signup — SECURITY DEFINER because anon must be able to insert a
-- row into a table it cannot read.
-- -----------------------------------------------------------------------------
create or replace function public.subscribe_to_newsletter(
  p_email text,
  p_kinds public.newsletter_kind[] default '{daily_digest}',
  p_language public.content_language default 'te',
  p_source text default 'website'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if p_email is null or position('@' in p_email) < 2 then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers (email, profile_id, kinds, language, source, confirmation_token)
  values (
    lower(btrim(p_email)),
    (select auth.uid()),
    coalesce(p_kinds, '{daily_digest}'),
    coalesce(p_language, 'te'),
    p_source,
    encode(extensions.gen_random_bytes(24), 'hex')
  )
  on conflict (lower(email)) do update
    set kinds = (
          select array_agg(distinct k)
          from unnest(public.newsletter_subscribers.kinds || excluded.kinds) as k
        ),
        unsubscribed_at = null,
        updated_at = now()
  returning confirmation_token into v_token;

  return v_token;
end;
$$;

grant execute on function public.subscribe_to_newsletter(text, public.newsletter_kind[], public.content_language, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Workflow RPCs. These wrap the state machine so the admin app expresses
-- intent ("submit", "approve") instead of poking at a status column.
-- -----------------------------------------------------------------------------
create or replace function public.submit_article(p_article_id uuid, p_note text default null)
returns public.article_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.article_status;
begin
  update public.articles
     set status = 'submitted'
   where id = p_article_id
   returning status into v_status;

  if v_status is null then
    raise exception 'article not found or not writable' using errcode = '42501';
  end if;

  insert into public.article_status_history (article_id, to_status, action, actor_id, note)
  values (p_article_id, v_status, 'submitted', (select auth.uid()), p_note);

  return v_status;
end;
$$;

create or replace function public.review_article(
  p_article_id uuid,
  p_action public.review_action,
  p_comment text default null
)
returns public.article_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_next public.article_status;
  v_status public.article_status;
begin
  if not public.is_editorial() then
    raise exception 'only editors may review submissions' using errcode = '42501';
  end if;

  v_next := case p_action
    when 'claimed' then 'in_review'
    when 'approved' then 'approved'
    when 'changes_requested' then 'changes_requested'
    when 'rejected' then 'archived'
    when 'archived' then 'archived'
    else null
  end;

  if v_next is null then
    raise exception 'unsupported review action: %', p_action using errcode = '22023';
  end if;

  update public.articles
     set status = v_next, editor_id = (select auth.uid())
   where id = p_article_id
   returning status into v_status;

  if v_status is null then
    raise exception 'article not found' using errcode = 'P0002';
  end if;

  insert into public.editor_reviews (article_id, reviewer_id, action, comment)
  values (p_article_id, (select auth.uid()), p_action, p_comment);

  insert into public.article_status_history (article_id, to_status, action, actor_id, note)
  values (p_article_id, v_status, p_action, (select auth.uid()), p_comment);

  -- Tell the reporter something happened to their story.
  insert into public.notifications (profile_id, kind, title, body, link)
  select a.author_id,
         'review.' || p_action::text,
         case p_action
           when 'approved' then 'Your story was approved'
           when 'changes_requested' then 'An editor requested changes'
           when 'rejected' then 'Your story was rejected'
           else 'Your story was updated'
         end,
         coalesce(p_comment, a.title),
         '/articles/' || a.id::text
  from public.articles a
  where a.id = p_article_id and a.author_id is distinct from (select auth.uid());

  return v_status;
end;
$$;

create or replace function public.publish_article(
  p_article_id uuid,
  p_scheduled_for timestamptz default null
)
returns public.article_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.article_status;
begin
  if p_scheduled_for is not null and p_scheduled_for > now() then
    update public.articles
       set status = 'scheduled', scheduled_for = p_scheduled_for
     where id = p_article_id
     returning status into v_status;
  else
    update public.articles
       set status = 'published', published_at = coalesce(published_at, now())
     where id = p_article_id
     returning status into v_status;
  end if;

  if v_status is null then
    raise exception 'article not found or not writable' using errcode = '42501';
  end if;

  return v_status;
end;
$$;

-- Publishes everything whose scheduled time has arrived. Driven by a Vercel
-- cron hitting /api/cron/publish-scheduled.
create or replace function public.publish_due_articles()
returns table (id uuid, slug text, category_slug text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    update public.articles a
       set status = 'published',
           published_at = coalesce(a.scheduled_for, now())
     where a.status = 'scheduled'
       and a.scheduled_for <= now()
    returning a.id, a.slug, a.category_id
  )
  select d.id, d.slug, c.slug
  from due d join public.categories c on c.id = d.category_id;
end;
$$;
