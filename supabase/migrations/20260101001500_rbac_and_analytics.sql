-- =============================================================================
-- BCM10 News — 1500 staff accounts and newsroom analytics
-- =============================================================================
-- Two additions:
--
--  1. Support for admin-created staff accounts. Reporters do not sign
--     themselves up; an editor creates the account with a temporary password,
--     and the reporter is made to change it on first sign-in.
--
--  2. Aggregate functions for the analytics dashboard. These run in SQL rather
--     than pulling rows into the application, because "views per day for the
--     last 30 days" over article_views is a grouped scan that should never
--     cross the wire.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Staff account bookkeeping
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists invited_by uuid references public.profiles (id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists password_changed_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.must_change_password is
  'Set when an editor creates the account with a temporary password. The newsroom blocks every route except the password change until it is cleared.';

create index if not exists profiles_active_staff_idx
  on public.profiles (role, created_at desc)
  where is_active and role <> 'reader';

-- A reporter clearing their own flag is exactly what we want after they change
-- their password, so this column is deliberately NOT in guard_profile_privileges().
-- It grants nothing on its own.

-- -----------------------------------------------------------------------------
-- Deactivation is preferred over deletion.
--
-- Deleting an auth user cascades to their profile, and articles reference the
-- author with ON DELETE RESTRICT — so a reporter who has filed anything cannot
-- be deleted at all, and should not be: their byline is part of the published
-- record. Deactivating revokes access while leaving the archive intact.
-- -----------------------------------------------------------------------------
create or replace function public.set_staff_active(p_profile uuid, p_active boolean)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is not null and not public.is_admin() then
    raise exception 'only a super_admin may change account status'
      using errcode = '42501';
  end if;

  if p_profile = v_actor then
    raise exception 'you cannot deactivate your own account'
      using errcode = '42501';
  end if;

  update public.profiles
     set is_active = p_active,
         deactivated_at = case when p_active then null else now() end,
         deactivated_by = case when p_active then null else v_actor end
   where id = p_profile
   returning * into v_row;

  if v_row.id is null then
    raise exception 'no such account' using errcode = 'P0002';
  end if;

  perform public.write_audit_log(
    case when p_active then 'profile.reactivated' else 'profile.deactivated' end,
    'profile',
    p_profile::text,
    jsonb_build_object('email', v_row.email, 'role', v_row.role)
  );

  return v_row;
end;
$$;

-- =============================================================================
-- Analytics
-- =============================================================================
-- All of these are SECURITY DEFINER and check is_editorial() themselves, because
-- article_views is readable only by editorial and these need to aggregate across
-- every row.
-- -----------------------------------------------------------------------------

/**
 * Headline numbers for the dashboard, with the previous period for comparison.
 * A number without a trend is not worth putting on a dashboard.
 */
create or replace function public.site_analytics(p_days int default 30)
returns table (
  views bigint,
  visitors bigint,
  articles_published bigint,
  avg_read_depth numeric,
  prev_views bigint,
  prev_visitors bigint,
  prev_articles_published bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_prev_from timestamptz := now() - make_interval(days => v_days * 2);
begin
  if not public.is_editorial() and (select auth.uid()) is not null then
    raise exception 'analytics are available to editors only' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.article_views v where v.viewed_at >= v_from),
    (select count(distinct v.visitor_hash) from public.article_views v
      where v.viewed_at >= v_from and v.visitor_hash is not null),
    (select count(*) from public.articles a
      where a.status = 'published' and a.published_at >= v_from),
    (select round(avg(v.read_depth), 1) from public.article_views v
      where v.viewed_at >= v_from and v.read_depth is not null),
    (select count(*) from public.article_views v
      where v.viewed_at >= v_prev_from and v.viewed_at < v_from),
    (select count(distinct v.visitor_hash) from public.article_views v
      where v.viewed_at >= v_prev_from and v.viewed_at < v_from and v.visitor_hash is not null),
    (select count(*) from public.articles a
      where a.status = 'published' and a.published_at >= v_prev_from and a.published_at < v_from);
end;
$$;

/** Daily series for the traffic chart. Gap-filled, so the chart has no holes. */
create or replace function public.views_by_day(p_days int default 30)
returns table (day date, views bigint, visitors bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if not public.is_editorial() and (select auth.uid()) is not null then
    raise exception 'analytics are available to editors only' using errcode = '42501';
  end if;

  return query
  -- generate_series then LEFT JOIN: a day with no traffic must plot as zero,
  -- not vanish and make the line lie about the shape of the week.
  select
    d.day::date,
    count(v.id) as views,
    count(distinct v.visitor_hash) as visitors
  from generate_series(
         (now() - make_interval(days => v_days - 1))::date,
         now()::date,
         interval '1 day'
       ) as d(day)
  left join public.article_views v
    on v.viewed_at >= d.day
   and v.viewed_at < d.day + interval '1 day'
  group by d.day
  order by d.day;
end;
$$;

/** The stories that actually earned attention in the window. */
create or replace function public.top_articles(p_days int default 30, p_limit int default 20)
returns table (
  article_id uuid,
  slug text,
  title text,
  category_name text,
  author_name text,
  published_at timestamptz,
  views bigint,
  visitors bigint,
  avg_read_depth numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
begin
  if not public.is_editorial() and (select auth.uid()) is not null then
    raise exception 'analytics are available to editors only' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.slug,
    a.title,
    c.name,
    coalesce(p.display_name, p.full_name),
    a.published_at,
    count(v.id),
    count(distinct v.visitor_hash),
    round(avg(v.read_depth), 1)
  from public.articles a
  join public.categories c on c.id = a.category_id
  join public.profiles p on p.id = a.author_id
  left join public.article_views v on v.article_id = a.id and v.viewed_at >= v_from
  where a.status = 'published'
  group by a.id, a.slug, a.title, c.name, p.display_name, p.full_name, a.published_at
  having count(v.id) > 0
  order by count(v.id) desc
  limit least(coalesce(p_limit, 20), 100);
end;
$$;

/** Which desks are pulling their weight. */
create or replace function public.category_analytics(p_days int default 30)
returns table (
  category_id uuid,
  category_slug text,
  category_name text,
  articles bigint,
  views bigint,
  views_per_article numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
begin
  if not public.is_editorial() and (select auth.uid()) is not null then
    raise exception 'analytics are available to editors only' using errcode = '42501';
  end if;

  return query
  select
    c.id, c.slug, c.name,
    count(distinct a.id),
    count(v.id),
    case when count(distinct a.id) = 0 then 0
         else round(count(v.id)::numeric / count(distinct a.id), 1) end
  from public.categories c
  left join public.articles a
    on a.category_id = c.id and a.status = 'published' and a.published_at >= v_from
  left join public.article_views v
    on v.article_id = a.id and v.viewed_at >= v_from
  where c.is_active
  group by c.id, c.slug, c.name
  order by count(v.id) desc;
end;
$$;

/** Reporter throughput and reach, for the desk. */
create or replace function public.reporter_analytics(p_days int default 30)
returns table (
  profile_id uuid,
  name text,
  role public.user_role,
  published bigint,
  drafts bigint,
  views bigint,
  avg_views_per_article numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
begin
  if not public.is_editorial() and (select auth.uid()) is not null then
    raise exception 'analytics are available to editors only' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(p.display_name, p.full_name),
    p.role,
    count(distinct a.id) filter (where a.status = 'published'),
    count(distinct a.id) filter (where a.status in ('draft', 'changes_requested')),
    count(v.id),
    case when count(distinct a.id) filter (where a.status = 'published') = 0 then 0
         else round(count(v.id)::numeric
                    / count(distinct a.id) filter (where a.status = 'published'), 1) end
  from public.profiles p
  left join public.articles a
    on a.author_id = p.id and a.created_at >= v_from
  left join public.article_views v
    on v.article_id = a.id and v.viewed_at >= v_from
  where p.role in ('reporter', 'editor', 'managing_editor', 'super_admin')
    and p.is_active
  group by p.id, p.display_name, p.full_name, p.role
  order by count(v.id) desc;
end;
$$;

/** Everything the per-article analytics page needs, in one round trip. */
create or replace function public.article_analytics(p_article uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_result jsonb;
begin
  if not public.is_editorial() and (select auth.uid()) is not null then
    -- A reporter may see the numbers for their own story, which is the whole
    -- point of showing them: it is how they learn what readers respond to.
    if not exists (
      select 1 from public.articles a
      where a.id = p_article and a.author_id = (select auth.uid())
    ) then
      raise exception 'not your story' using errcode = '42501';
    end if;
  end if;

  select jsonb_build_object(
    'total_views', (select count(*) from public.article_views v where v.article_id = p_article),
    'window_views', (select count(*) from public.article_views v
                      where v.article_id = p_article and v.viewed_at >= v_from),
    'visitors', (select count(distinct v.visitor_hash) from public.article_views v
                  where v.article_id = p_article and v.viewed_at >= v_from
                    and v.visitor_hash is not null),
    'avg_read_depth', (select round(avg(v.read_depth), 1) from public.article_views v
                        where v.article_id = p_article and v.read_depth is not null),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'views', n) order by d.day)
      from (
        select gs.day::date as day, count(v.id) as n
        from generate_series(
               (now() - make_interval(days => v_days - 1))::date, now()::date, interval '1 day'
             ) gs(day)
        left join public.article_views v
          on v.article_id = p_article
         and v.viewed_at >= gs.day and v.viewed_at < gs.day + interval '1 day'
        group by gs.day
      ) d
    ), '[]'::jsonb),
    'by_referrer', coalesce((
      select jsonb_agg(jsonb_build_object('host', host, 'views', n) order by n desc)
      from (
        select coalesce(nullif(v.referrer_host, ''), 'direct') as host, count(*) as n
        from public.article_views v
        where v.article_id = p_article and v.viewed_at >= v_from
        group by 1 order by 2 desc limit 10
      ) r
    ), '[]'::jsonb),
    'by_device', coalesce((
      select jsonb_agg(jsonb_build_object('device', device, 'views', n) order by n desc)
      from (
        select coalesce(nullif(v.device_kind, ''), 'unknown') as device, count(*) as n
        from public.article_views v
        where v.article_id = p_article and v.viewed_at >= v_from
        group by 1
      ) dv
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.site_analytics(int) to authenticated;
grant execute on function public.views_by_day(int) to authenticated;
grant execute on function public.top_articles(int, int) to authenticated;
grant execute on function public.category_analytics(int) to authenticated;
grant execute on function public.reporter_analytics(int) to authenticated;
grant execute on function public.article_analytics(uuid, int) to authenticated;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;
