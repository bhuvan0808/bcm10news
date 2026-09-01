-- =============================================================================
-- BCM10 News — 1100 Row Level Security
-- =============================================================================
-- Every table in `public` has RLS enabled. A table with RLS on and no policy
-- denies everything to anon/authenticated, which is the intended posture for
-- the webhook landing tables — only the service role touches those.
--
-- The paywall is enforced here, not in the UI: a premium article's row is not
-- visible to a reader without the entitlement, so there is no body to leak.
-- The teaser comes from public.article_previews, which exposes safe columns
-- only.
-- =============================================================================

alter table public.profiles                enable row level security;
alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.categories              enable row level security;
alter table public.locations               enable row level security;
alter table public.tags                    enable row level security;
alter table public.media                   enable row level security;
alter table public.upload_tickets          enable row level security;
alter table public.articles                enable row level security;
alter table public.article_slug_history    enable row level security;
alter table public.article_tags            enable row level security;
alter table public.article_media           enable row level security;
alter table public.article_videos          enable row level security;
alter table public.article_related         enable row level security;
alter table public.article_coauthors       enable row level security;
alter table public.article_revisions       enable row level security;
alter table public.article_status_history  enable row level security;
alter table public.editor_reviews          enable row level security;
alter table public.article_assignments     enable row level security;
alter table public.article_views           enable row level security;
alter table public.saved_articles          enable row level security;
alter table public.followed_categories     enable row level security;
alter table public.followed_authors        enable row level security;
alter table public.comments                enable row level security;
alter table public.subscription_plans      enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.payments                enable row level security;
alter table public.invoices                enable row level security;
alter table public.payment_events          enable row level security;
alter table public.entitlements            enable row level security;
alter table public.content_licenses        enable row level security;
alter table public.license_usage           enable row level security;
alter table public.newsletter_subscribers  enable row level security;
alter table public.newsletter_campaigns    enable row level security;
alter table public.email_events            enable row level security;
alter table public.push_subscribers        enable row level security;
alter table public.push_notifications      enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.site_settings           enable row level security;
alter table public.homepage_sections       enable row level security;
alter table public.notifications           enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================
create policy "profiles: read own"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "profiles: newsroom reads colleagues"
  on public.profiles for select
  using (public.is_newsroom());

create policy "profiles: subscription managers read customers"
  on public.profiles for select
  using (public.manages_subscriptions());

create policy "profiles: update own"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles: admin manages all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- A user may edit their own profile but not their own privileges. Without this
-- guard the "update own" policy above would let any reader make themself an
-- editor, because RLS cannot express column-level restrictions.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.can_publish is distinct from old.can_publish
     or new.can_send_push is distinct from old.can_send_push
     or new.can_manage_media_library is distinct from old.can_manage_media_library
     or new.is_active is distinct from old.is_active then
    raise exception 'privilege columns may only be changed by a super_admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- =============================================================================
-- organizations
-- =============================================================================
create policy "organizations: members read"
  on public.organizations for select
  using (public.is_org_member(id) or public.manages_subscriptions());

create policy "organizations: managers write"
  on public.organizations for all
  using (public.manages_subscriptions())
  with check (public.manages_subscriptions());

create policy "org members: read own org"
  on public.organization_members for select
  using (profile_id = (select auth.uid()) or public.is_org_member(organization_id) or public.manages_subscriptions());

create policy "org members: managers write"
  on public.organization_members for all
  using (public.manages_subscriptions())
  with check (public.manages_subscriptions());

-- =============================================================================
-- taxonomy — world-readable when active, editorial to write
-- =============================================================================
create policy "categories: public read"
  on public.categories for select
  using (is_active or public.is_newsroom());

create policy "categories: editorial write"
  on public.categories for all
  using (public.is_editorial())
  with check (public.is_editorial());

create policy "locations: public read"
  on public.locations for select
  using (is_active or public.is_newsroom());

create policy "locations: editorial write"
  on public.locations for all
  using (public.is_editorial())
  with check (public.is_editorial());

create policy "tags: public read"
  on public.tags for select
  using (true);

create policy "tags: newsroom writes"
  on public.tags for insert
  with check (public.is_newsroom());

create policy "tags: editorial updates"
  on public.tags for update
  using (public.is_editorial())
  with check (public.is_editorial());

create policy "tags: admin deletes"
  on public.tags for delete
  using (public.is_admin());

-- =============================================================================
-- media
-- =============================================================================
create policy "media: public reads published assets"
  on public.media for select
  using (is_public and not is_archived);

create policy "media: newsroom reads library"
  on public.media for select
  using (public.is_newsroom());

create policy "media: newsroom uploads"
  on public.media for insert
  with check (public.is_newsroom() and uploaded_by = (select auth.uid()));

create policy "media: uploader edits own"
  on public.media for update
  using (uploaded_by = (select auth.uid()) and public.is_newsroom())
  with check (uploaded_by = (select auth.uid()));

create policy "media: librarians edit all"
  on public.media for update
  using (public.is_editorial() or public.is_admin())
  with check (public.is_editorial() or public.is_admin());

create policy "media: admin deletes"
  on public.media for delete
  using (public.is_admin());

create policy "upload tickets: own"
  on public.upload_tickets for all
  using (requested_by = (select auth.uid()) or public.is_admin())
  with check (requested_by = (select auth.uid()));

-- =============================================================================
-- articles — the paywall lives here
-- =============================================================================
create policy "articles: public reads free published"
  on public.articles for select
  using (status = 'published' and not is_premium);

create policy "articles: entitled readers see premium"
  on public.articles for select
  using (
    status = 'published'
    and is_premium
    and public.has_entitlement('premium_content')
  );

create policy "articles: licensed organizations read"
  on public.articles for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.content_licenses cl
      join public.organization_members om on om.organization_id = cl.organization_id
      where om.profile_id = (select auth.uid())
        and cl.is_active
        and (cl.period_end is null or cl.period_end > now())
        and (
          cardinality(cl.allowed_category_ids) = 0
          or public.articles.category_id = any (cl.allowed_category_ids)
        )
    )
  );

create policy "articles: authors read own"
  on public.articles for select
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.article_coauthors ac
      where ac.article_id = public.articles.id and ac.profile_id = (select auth.uid())
    )
  );

create policy "articles: editorial reads all"
  on public.articles for select
  using (public.is_editorial());

create policy "articles: reporters create own"
  on public.articles for insert
  with check (
    public.is_newsroom()
    and author_id = (select auth.uid())
    and status in ('draft', 'submitted')
  );

create policy "articles: editorial creates any"
  on public.articles for insert
  with check (public.is_editorial());

-- A reporter owns a story until the desk has it. Once it leaves their hands
-- (submitted / in_review / approved / scheduled / published) only the desk may
-- edit, which is what stops a story changing under a reviewer.
create policy "articles: authors edit own unpublished"
  on public.articles for update
  using (
    author_id = (select auth.uid())
    and status in ('draft', 'changes_requested')
  )
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'submitted', 'changes_requested')
  );

create policy "articles: editorial edits all"
  on public.articles for update
  using (public.is_editorial())
  with check (public.is_editorial());

create policy "articles: authors delete own drafts"
  on public.articles for delete
  using (author_id = (select auth.uid()) and status = 'draft');

create policy "articles: admin deletes"
  on public.articles for delete
  using (public.is_admin());

-- Publishing is a privileged act even for the row's owner.
create or replace function public.guard_publish_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('published', 'scheduled', 'approved')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not public.can_publish() then
    raise exception 'publishing requires the can_publish grant or an editorial role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger articles_guard_publish
  before insert or update of status on public.articles
  for each row execute function public.guard_publish_permission();

create policy "slug history: public read"
  on public.article_slug_history for select
  using (true);

-- =============================================================================
-- article relations — visibility follows the parent article, because the
-- EXISTS below is evaluated under the caller's own RLS on articles.
-- =============================================================================
create or replace function public.can_read_article(p_article uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.articles a where a.id = p_article);
$$;

create or replace function public.can_edit_article(p_article uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.articles a
    where a.id = p_article
      and (
        public.is_editorial()
        or (a.author_id = (select auth.uid()) and a.status in ('draft', 'changes_requested'))
      )
  );
$$;

create policy "article tags: read with article"
  on public.article_tags for select using (public.can_read_article(article_id));
create policy "article tags: write with article"
  on public.article_tags for all
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

create policy "article media: read with article"
  on public.article_media for select using (public.can_read_article(article_id));
create policy "article media: write with article"
  on public.article_media for all
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

create policy "article videos: read with article"
  on public.article_videos for select using (public.can_read_article(article_id));
create policy "article videos: write with article"
  on public.article_videos for all
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

create policy "article related: read with article"
  on public.article_related for select using (public.can_read_article(article_id));
create policy "article related: write with article"
  on public.article_related for all
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

create policy "article coauthors: read with article"
  on public.article_coauthors for select using (public.can_read_article(article_id));
create policy "article coauthors: editorial writes"
  on public.article_coauthors for all
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

-- =============================================================================
-- workflow tables — newsroom only, never public
-- =============================================================================
create policy "revisions: newsroom reads"
  on public.article_revisions for select
  using (public.is_editorial() or exists (
    select 1 from public.articles a
    where a.id = article_id and a.author_id = (select auth.uid())
  ));

create policy "status history: newsroom reads"
  on public.article_status_history for select
  using (public.is_editorial() or exists (
    select 1 from public.articles a
    where a.id = article_id and a.author_id = (select auth.uid())
  ));

create policy "reviews: participants read"
  on public.editor_reviews for select
  using (
    public.is_editorial()
    or reviewer_id = (select auth.uid())
    or exists (
      select 1 from public.articles a
      where a.id = article_id and a.author_id = (select auth.uid())
    )
  );

create policy "reviews: editorial writes"
  on public.editor_reviews for insert
  with check (public.is_editorial() and reviewer_id = (select auth.uid()));

create policy "reviews: reviewer updates own"
  on public.editor_reviews for update
  using (reviewer_id = (select auth.uid()) or public.is_editorial())
  with check (reviewer_id = (select auth.uid()) or public.is_editorial());

create policy "assignments: assignee or desk reads"
  on public.article_assignments for select
  using (assigned_to = (select auth.uid()) or assigned_by = (select auth.uid()) or public.is_editorial());

create policy "assignments: desk writes"
  on public.article_assignments for all
  using (public.is_editorial())
  with check (public.is_editorial() and assigned_by = (select auth.uid()));

create policy "assignments: assignee accepts"
  on public.article_assignments for update
  using (assigned_to = (select auth.uid()))
  with check (assigned_to = (select auth.uid()));

-- =============================================================================
-- engagement
-- =============================================================================
-- Views are written only through record_article_view(); no direct INSERT policy.
create policy "views: editorial reads"
  on public.article_views for select
  using (public.is_editorial());

create policy "saved: own rows"
  on public.saved_articles for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "followed categories: own rows"
  on public.followed_categories for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "followed authors: own rows"
  on public.followed_authors for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "comments: public reads approved"
  on public.comments for select
  using (is_approved or profile_id = (select auth.uid()) or public.is_editorial());

create policy "comments: readers write own"
  on public.comments for insert
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.articles a
      where a.id = article_id and a.status = 'published' and a.allow_comments
    )
  );

create policy "comments: author edits own"
  on public.comments for update
  using (profile_id = (select auth.uid()) and created_at > now() - interval '15 minutes')
  with check (profile_id = (select auth.uid()));

create policy "comments: editorial moderates"
  on public.comments for all
  using (public.is_editorial())
  with check (public.is_editorial());

create policy "comments: author deletes own"
  on public.comments for delete
  using (profile_id = (select auth.uid()) or public.is_editorial());

-- =============================================================================
-- commerce
-- =============================================================================
create policy "plans: public reads active"
  on public.subscription_plans for select
  using ((is_active and is_public) or public.manages_subscriptions());

create policy "plans: managers write"
  on public.subscription_plans for all
  using (public.manages_subscriptions())
  with check (public.manages_subscriptions());

create policy "subscriptions: owner reads"
  on public.subscriptions for select
  using (
    profile_id = (select auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
    or public.manages_subscriptions()
  );

create policy "subscriptions: managers write"
  on public.subscriptions for all
  using (public.manages_subscriptions())
  with check (public.manages_subscriptions());

create policy "payments: owner reads"
  on public.payments for select
  using (
    profile_id = (select auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
    or public.manages_subscriptions()
  );

create policy "invoices: owner reads"
  on public.invoices for select
  using (
    profile_id = (select auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
    or public.manages_subscriptions()
  );

create policy "entitlements: owner reads"
  on public.entitlements for select
  using (
    profile_id = (select auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
    or public.manages_subscriptions()
  );

-- payment_events intentionally has no policy: only the service role, running
-- the webhook handler, may read or write it.

-- =============================================================================
-- licensing
-- =============================================================================
create policy "licenses: org members read"
  on public.content_licenses for select
  using (public.is_org_member(organization_id) or public.manages_subscriptions());

create policy "licenses: managers write"
  on public.content_licenses for all
  using (public.manages_subscriptions())
  with check (public.manages_subscriptions());

create policy "license usage: org members read"
  on public.license_usage for select
  using (public.is_org_member(organization_id) or public.manages_subscriptions());

-- =============================================================================
-- communications
-- =============================================================================
-- The subscriber list is never readable by the public; sign-up goes through
-- subscribe_to_newsletter(), which is SECURITY DEFINER.
create policy "newsletter: self and managers read"
  on public.newsletter_subscribers for select
  using (profile_id = (select auth.uid()) or public.is_editorial() or public.is_admin());

create policy "newsletter: self updates preferences"
  on public.newsletter_subscribers for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "newsletter: admin manages"
  on public.newsletter_subscribers for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "campaigns: editorial reads"
  on public.newsletter_campaigns for select using (public.is_editorial());
create policy "campaigns: editorial writes"
  on public.newsletter_campaigns for all
  using (public.is_editorial()) with check (public.is_editorial());

create policy "email events: admin reads"
  on public.email_events for select using (public.is_admin());

create policy "push subscribers: own row"
  on public.push_subscribers for all
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy "push notifications: newsroom reads"
  on public.push_notifications for select using (public.is_newsroom());
create policy "push notifications: senders write"
  on public.push_notifications for insert
  with check (public.is_editorial());

-- =============================================================================
-- audit, settings, notifications
-- =============================================================================
create policy "audit: admin reads"
  on public.audit_logs for select using (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: rows arrive only via write_audit_log(),
-- which is SECURITY DEFINER. The log is append-only for every human role.

create policy "settings: public reads"
  on public.site_settings for select using (true);
create policy "settings: admin writes"
  on public.site_settings for update
  using (public.is_admin()) with check (public.is_admin());

create policy "homepage sections: public reads active"
  on public.homepage_sections for select
  using (is_active or public.is_editorial());
create policy "homepage sections: editorial writes"
  on public.homepage_sections for all
  using (public.is_editorial()) with check (public.is_editorial());

create policy "notifications: own inbox"
  on public.notifications for select
  using (profile_id = (select auth.uid()));
create policy "notifications: mark own read"
  on public.notifications for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
