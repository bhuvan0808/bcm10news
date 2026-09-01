-- =============================================================================
-- BCM10 News — 1400 let the first super_admin be created
-- =============================================================================
-- guard_profile_privileges() rejected any change to role/can_publish/is_active
-- unless is_admin() was true. On a fresh install nobody is an admin, so the
-- first super_admin could never be promoted and the newsroom could not be
-- opened at all. The bootstrap instructions in docs/deployment.md were
-- therefore wrong: they failed with
--
--   42501: privilege columns may only be changed by a super_admin
--
-- The fix is to let the guard pass when there is no authenticated user —
-- `auth.uid()` is null. That is precisely the operator's path: the service-role
-- key, the SQL editor, or a psql session.
--
-- This grants nothing that was not already available:
--
--   • service_role bypasses RLS entirely by design, so a holder of that key
--     could already rewrite the table.
--   • anon also has a null auth.uid(), but RLS on `profiles` gives it no row to
--     update: the "update own" policy needs auth.uid() = id, which is never
--     true for null, and the admin policy needs is_admin(). The guard is a
--     BEFORE trigger, so it only runs on rows a policy has already admitted.
--
-- So the guard keeps doing its real job — stopping a signed-in reader from
-- promoting themself through the "update own" policy, which RLS cannot express
-- at column level — while no longer blocking the operator who owns the database.
-- =============================================================================

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No session: the service role, the SQL editor, or psql. Such a caller can
  -- already do anything; blocking here only prevented bootstrapping.
  if (select auth.uid()) is null then
    return new;
  end if;

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

comment on function public.guard_profile_privileges is
  'Stops a signed-in user editing their own privileges via the "update own" policy. Passes for sessionless callers (service role / psql), which is how the first super_admin is created.';
