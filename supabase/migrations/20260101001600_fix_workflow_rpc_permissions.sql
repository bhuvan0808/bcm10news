-- =============================================================================
-- BCM10 News — 1600 let the workflow RPCs write their own bookkeeping
-- =============================================================================
-- submit_article() and review_article() are SECURITY INVOKER, which is correct
-- and deliberate: the UPDATE they perform must be checked by RLS, or a reporter
-- could submit somebody else's story.
--
-- But they also wrote directly to article_status_history and notifications, and
-- neither table has an INSERT policy — by design, since those are append-only
-- logs nobody should write to by hand. The result was that submitting a story
-- failed outright:
--
--   42501: new row violates row-level security policy for table
--          "article_status_history"
--
-- The status change itself did work, because log_article_transition() is a
-- SECURITY DEFINER trigger. Only the RPC's extra row — the one carrying the
-- action and the reporter's note — was refused.
--
-- The fix keeps the authorization where it belongs. The UPDATE stays under RLS;
-- the bookkeeping moves into SECURITY DEFINER helpers that can do one narrow
-- thing each and nothing else. A definer wrapper around the whole RPC would
-- have been less code and would have thrown away the RLS check that stops a
-- reporter touching another reporter's story.
-- =============================================================================

/**
 * Appends the action and note to the history row the trigger has just written.
 *
 * An UPDATE rather than an INSERT, so the timeline shows one entry per
 * transition instead of two saying the same thing.
 */
create or replace function public.annotate_last_transition(
  p_article uuid,
  p_action public.review_action,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.article_status_history h
     set action = p_action,
         note = coalesce(p_note, h.note)
   where h.id = (
     select id from public.article_status_history
      where article_id = p_article
      order by created_at desc
      limit 1
   );
end;
$$;

/** In-app notification. Definer because notifications has no INSERT policy. */
create or replace function public.notify_profile(
  p_profile uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_profile is null then
    return;
  end if;

  insert into public.notifications (profile_id, kind, title, body, link)
  values (p_profile, p_kind, p_title, p_body, p_link);
end;
$$;

-- -----------------------------------------------------------------------------
-- submit_article — the UPDATE stays RLS-checked; the note goes through the
-- definer helper.
-- -----------------------------------------------------------------------------
create or replace function public.submit_article(p_article_id uuid, p_note text default null)
returns public.article_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.article_status;
  v_title text;
  v_editor uuid;
begin
  update public.articles
     set status = 'submitted'
   where id = p_article_id
   returning status, title into v_status, v_title;

  if v_status is null then
    raise exception 'article not found or not writable' using errcode = '42501';
  end if;

  perform public.annotate_last_transition(p_article_id, 'submitted', p_note);

  -- Tell the desk something is waiting. Best effort: a story must not fail to
  -- submit because an editor's inbox row could not be written.
  for v_editor in
    select id from public.profiles
     where is_active and role in ('editor', 'managing_editor', 'super_admin')
     limit 20
  loop
    perform public.notify_profile(
      v_editor,
      'review.submitted',
      'A story is waiting for review',
      v_title,
      '/articles/' || p_article_id::text
    );
  end loop;

  return v_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- review_article — same treatment. editor_reviews does have an INSERT policy
-- for editorial, so that write stays under RLS where it belongs.
-- -----------------------------------------------------------------------------
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
  v_author uuid;
  v_title text;
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
   returning status, author_id, title into v_status, v_author, v_title;

  if v_status is null then
    raise exception 'article not found' using errcode = 'P0002';
  end if;

  insert into public.editor_reviews (article_id, reviewer_id, action, comment)
  values (p_article_id, (select auth.uid()), p_action, p_comment);

  perform public.annotate_last_transition(p_article_id, p_action, p_comment);

  if v_author is distinct from (select auth.uid()) then
    perform public.notify_profile(
      v_author,
      'review.' || p_action::text,
      case p_action
        when 'approved' then 'Your story was approved'
        when 'changes_requested' then 'An editor requested changes'
        when 'rejected' then 'Your story was rejected'
        else 'Your story was updated'
      end,
      coalesce(p_comment, v_title),
      '/articles/' || p_article_id::text
    );
  end if;

  return v_status;
end;
$$;

grant execute on function public.annotate_last_transition(uuid, public.review_action, text) to authenticated;
grant execute on function public.notify_profile(uuid, text, text, text, text) to authenticated;
