import { redirect } from 'next/navigation';
import { createClient } from '@bcm10/database/server';
import type { ProfileRow, UserRole } from '@bcm10/database';

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

const RANKS: Record<UserRole, number> = {
  super_admin: 100,
  managing_editor: 80,
  editor: 60,
  subscription_manager: 40,
  reporter: 30,
  photographer: 20,
  business_customer: 10,
  reader: 0,
};

export function rank(role: UserRole): number {
  return RANKS[role] ?? 0;
}

export interface NewsroomSession {
  profile: ProfileRow;
  isEditorial: boolean;
  isAdmin: boolean;
  canPublish: boolean;
  canManageMedia: boolean;
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

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

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
  };
}

/** For pages only editors and above may open. */
export async function requireEditorial(returnTo?: string): Promise<NewsroomSession> {
  const session = await requireNewsroomUser(returnTo);
  if (!session.isEditorial) redirect('/no-access');
  return session;
}

export async function requireAdmin(returnTo?: string): Promise<NewsroomSession> {
  const session = await requireNewsroomUser(returnTo);
  if (!session.isAdmin) redirect('/no-access');
  return session;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super admin',
  managing_editor: 'Managing editor',
  editor: 'Editor',
  reporter: 'Reporter',
  photographer: 'Photographer',
  subscription_manager: 'Subscription manager',
  business_customer: 'Business account',
  reader: 'Reader',
};
