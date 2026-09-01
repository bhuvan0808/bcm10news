import { redirect } from 'next/navigation';
import { createClient } from '@bcm10/database/server';
import type { ProfileRow } from '@bcm10/database';
import { RANKS, rank } from './roles';

// Re-exported so server code has one import for role questions.
export { RANKS, rank, ROLE_LABELS, ASSIGNABLE_ROLES } from './roles';

/**
 * Server-side authorization for the newsroom.
 *
 * This is the *second* line of defence, not the first. RLS in Postgres is what
 * actually stops a reporter reading someone else's draft — these helpers exist
 * so the UI can fail early with a sensible message instead of rendering an
 * empty page after the database quietly returned nothing.
 *
 * Never rely on a check here alone. If a policy is missing, this will not save
 * you; if a policy is right, a bug here is a UX problem rather than a breach.
 */

export interface NewsroomSession {
  profile: ProfileRow;
  isEditorial: boolean;
  isAdmin: boolean;
  canPublish: boolean;
  canManageMedia: boolean;
  /** Set for an admin-created account whose temporary password still stands. */
  mustChangePassword: boolean;
}

/**
 * Loads the signed-in newsroom user, or redirects to sign-in.
 *
 * `getUser()` rather than `getSession()`: getSession trusts the cookie, while
 * getUser revalidates the token with the auth server. Every authorization
 * decision below hangs off this call, so it has to be the verified one.
 */
export async function requireNewsroomUser(returnTo?: string): Promise<NewsroomSession> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : '/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    // The auth trigger creates a profile on sign-up, so a missing one means
    // something is genuinely wrong rather than that they are new.
    redirect('/sign-in?error=no-profile');
  }

  if (!profile.is_active) redirect('/sign-in?error=deactivated');

  // Readers and business customers have accounts, but not newsroom ones.
  if (rank(profile.role) < RANKS.photographer) redirect('/no-access');

  return {
    profile,
    isEditorial: rank(profile.role) >= RANKS.editor,
    isAdmin: profile.role === 'super_admin',
    canPublish: profile.can_publish || rank(profile.role) >= RANKS.editor,
    canManageMedia: profile.can_manage_media_library || rank(profile.role) >= RANKS.editor,
    mustChangePassword: profile.must_change_password === true,
  };
}

/**
 * Every newsroom route except the password change itself.
 *
 * An account still on its issued temporary password is not yet the person it
 * claims to be — the password has been read aloud, forwarded, or sat in an
 * inbox. Gating here rather than in each page means a new route cannot forget.
 */
export async function requireNewsroomUserWithPassword(returnTo?: string): Promise<NewsroomSession> {
  const session = await requireNewsroomUser(returnTo);
  if (session.mustChangePassword) redirect('/account/password?first=1');
  return session;
}

/** For pages only editors and above may open. */
export async function requireEditorial(returnTo?: string): Promise<NewsroomSession> {
  const session = await requireNewsroomUserWithPassword(returnTo);
  if (!session.isEditorial) redirect('/no-access');
  return session;
}

export async function requireAdmin(returnTo?: string): Promise<NewsroomSession> {
  const session = await requireNewsroomUserWithPassword(returnTo);
  if (!session.isAdmin) redirect('/no-access');
  return session;
}
