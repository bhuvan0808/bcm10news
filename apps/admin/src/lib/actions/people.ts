'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@bcm10/database/admin';
import { createClient } from '@bcm10/database/server';
import { createEmailService } from '@bcm10/email';
import { requireAdmin, requireNewsroomUser } from '@/lib/auth';
import { ADMIN } from '@/lib/site';
import type { TablesUpdate } from '@bcm10/database';
import type { ActionResult } from './articles';

/**
 * Staff accounts.
 *
 * Reporters do not sign themselves up. An editor creates the account, the
 * system generates a temporary password, and the reporter is forced to replace
 * it before they can reach anything else.
 *
 * A generated password beats one an admin invents: it is long, it is random,
 * and nobody is tempted to reuse "bcm10@123" across the whole newsroom.
 */

const createStaffInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  fullName: z.string().trim().min(2, 'Enter their name').max(120),
  displayName: z.string().trim().max(120).optional(),
  role: z.enum(['managing_editor', 'editor', 'reporter', 'photographer', 'subscription_manager']),
  designation: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  canPublish: z.boolean().default(false),
  canSendPush: z.boolean().default(false),
  canManageMedia: z.boolean().default(false),
});

const updateStaffInput = z.object({
  profileId: z.string().uuid(),
  displayName: z.string().trim().max(120).optional(),
  role: z
    .enum([
      'super_admin',
      'managing_editor',
      'editor',
      'reporter',
      'photographer',
      'subscription_manager',
    ])
    .optional(),
  designation: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  bio: z.string().trim().max(2000).optional(),
  canPublish: z.boolean().optional(),
  canSendPush: z.boolean().optional(),
  canManageMedia: z.boolean().optional(),
});

/**
 * Readable but strong: 4 words plus digits beats a random string an admin has
 * to read down a phone line and a reporter has to type on a handset.
 */
function generatePassword(): string {
  const words = [
    'amaravati',
    'godavari',
    'krishna',
    'tirupati',
    'warangal',
    'nizam',
    'kakinada',
    'guntur',
    'nellore',
    'kurnool',
    'khammam',
    'adilabad',
    'chittoor',
    'anantapur',
  ];
  const bytes = randomBytes(8);
  const pick = (i: number) => words[bytes[i]! % words.length];
  const digits = (bytes.readUInt16BE(6) % 9000) + 1000;
  return `${pick(0)}-${pick(1)}-${pick(2)}-${digits}`;
}

/** Slug for the public author page. Collisions get a numeric suffix. */
async function uniqueAuthorSlug(
  admin: ReturnType<typeof createAdminClient>,
  fullName: string
): Promise<string> {
  const base =
    fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'reporter';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data } = await admin.from('profiles').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export interface CreatedStaff {
  profileId: string;
  email: string;
  temporaryPassword: string;
  emailed: boolean;
}

export async function createStaffAccount(input: unknown): Promise<ActionResult<CreatedStaff>> {
  const session = await requireAdmin();

  const parsed = createStaffInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const staff = parsed.data;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('profiles')
    .select('id, is_active')
    .eq('email', staff.email)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      message: existing.is_active
        ? 'An account already exists for that email.'
        : 'A deactivated account exists for that email. Reactivate it instead of creating a new one.',
    };
  }

  const temporaryPassword = generatePassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: staff.email,
    password: temporaryPassword,
    // Confirmed on creation: the account was made by an editor who already
    // knows this person, so there is no address to prove ownership of.
    email_confirm: true,
    user_metadata: { full_name: staff.fullName },
  });

  if (authError || !created.user) {
    console.error('Could not create auth user', authError?.message);
    return { ok: false, message: authError?.message ?? 'Could not create the account.' };
  }

  const profileId = created.user.id;
  const slug = await uniqueAuthorSlug(admin, staff.fullName);

  // The auth trigger has already inserted a `reader` profile; fill in the rest.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: staff.fullName,
      display_name: staff.displayName || staff.fullName,
      role: staff.role,
      slug,
      designation: staff.designation ?? null,
      phone: staff.phone ?? null,
      can_publish: staff.canPublish,
      can_send_push: staff.canSendPush,
      can_manage_media_library: staff.canManageMedia,
      must_change_password: true,
      invited_by: session.profile.id,
      invited_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (profileError) {
    // Roll back the auth user, or a half-made account blocks the email forever.
    await admin.auth.admin.deleteUser(profileId).catch(() => undefined);
    console.error('Could not write profile', profileError.message);
    return { ok: false, message: 'Could not set up the account. Please try again.' };
  }

  // Best effort. The password is shown on screen regardless, because email is
  // not reliable enough to be the only way an editor can hand it over.
  let emailed = false;
  const email = createEmailService();

  if (email.enabled) {
    const result = await email.send({
      to: { email: staff.email, name: staff.fullName },
      subject: 'Your BCM10 newsroom account',
      template: 'welcome',
      html: staffWelcomeHtml({
        name: staff.fullName,
        email: staff.email,
        password: temporaryPassword,
        signInUrl: `${ADMIN.adminUrl}/sign-in`,
      }),
    });
    emailed = result.ok && !result.skipped;
  }

  await admin.rpc('write_audit_log', {
    p_action: 'staff.created',
    p_resource_type: 'profile',
    p_resource_id: profileId,
    p_metadata: { email: staff.email, role: staff.role, created_by: session.profile.email },
  });

  revalidatePath('/people');

  return {
    ok: true,
    message: `Account created for ${staff.fullName}.`,
    data: { profileId, email: staff.email, temporaryPassword, emailed },
  };
}

export async function updateStaffAccount(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = updateStaffInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.' };

  const { profileId, ...fields } = parsed.data;

  // Losing the last super_admin locks everyone out of role management, and the
  // only way back is a manual SQL edit.
  if (fields.role && fields.role !== 'super_admin') {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from('profiles')
      .select('role')
      .eq('id', profileId)
      .maybeSingle();

    if (target?.role === 'super_admin') {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('is_active', true);

      if ((count ?? 0) <= 1) {
        return { ok: false, message: 'This is the only super admin. Promote someone else first.' };
      }
    }
  }

  // The session client, so RLS and guard_profile_privileges() both apply —
  // the admin client would bypass exactly the checks worth keeping.
  const supabase = await createClient();

  // Typed against the table, so a mistyped column is a compile error rather
  // than a silently ignored field.
  const patch: TablesUpdate<'profiles'> = {};
  if (fields.displayName !== undefined) patch['display_name'] = fields.displayName || null;
  if (fields.role !== undefined) patch['role'] = fields.role;
  if (fields.designation !== undefined) patch['designation'] = fields.designation || null;
  if (fields.phone !== undefined) patch['phone'] = fields.phone || null;
  if (fields.bio !== undefined) patch['bio'] = fields.bio || null;
  if (fields.canPublish !== undefined) patch['can_publish'] = fields.canPublish;
  if (fields.canSendPush !== undefined) patch['can_send_push'] = fields.canSendPush;
  if (fields.canManageMedia !== undefined)
    patch['can_manage_media_library'] = fields.canManageMedia;

  if (!Object.keys(patch).length) return { ok: true };

  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);

  if (error) {
    console.error('Could not update staff', error.message);
    return { ok: false, message: 'Could not save those changes.' };
  }

  revalidatePath('/people');
  revalidatePath(`/people/${profileId}`);
  return { ok: true, message: 'Saved.' };
}

/**
 * Removing someone.
 *
 * Deactivation, not deletion. `articles.author_id` is ON DELETE RESTRICT, so a
 * reporter who has filed anything cannot be deleted — and should not be, because
 * the byline is part of the published record. Deactivating revokes access and
 * leaves the archive honest.
 */
export async function setStaffActive(profileId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_staff_active', {
    p_profile: profileId,
    p_active: active,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/people');
  return {
    ok: true,
    message: active ? 'Account reactivated.' : 'Account deactivated. Their stories are untouched.',
  };
}

/**
 * Permanent deletion.
 *
 * Only offered for an account that has never filed anything — someone added by
 * mistake, or who never started. Anything else must be deactivated.
 */
export async function deleteStaffAccount(profileId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  if (profileId === session.profile.id) {
    return { ok: false, message: 'You cannot delete your own account.' };
  }

  const admin = createAdminClient();

  const { count } = await admin
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profileId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `This account has ${count} ${count === 1 ? 'story' : 'stories'}. Deactivate it instead — deleting would break the bylines.`,
    };
  }

  const { data: target } = await admin
    .from('profiles')
    .select('email, role')
    .eq('id', profileId)
    .maybeSingle();

  const { error } = await admin.auth.admin.deleteUser(profileId);

  if (error) {
    console.error('Could not delete user', error.message);
    return { ok: false, message: 'Could not delete the account.' };
  }

  await admin.rpc('write_audit_log', {
    p_action: 'staff.deleted',
    p_resource_type: 'profile',
    p_resource_id: profileId,
    p_metadata: {
      email: target?.email ?? null,
      role: target?.role ?? null,
      deleted_by: session.profile.email,
    },
  });

  revalidatePath('/people');
  return { ok: true, message: 'Account deleted.' };
}

/** Issues a fresh temporary password. For "I've been locked out" over the phone. */
export async function resetStaffPassword(
  profileId: string
): Promise<ActionResult<{ password: string }>> {
  const session = await requireAdmin();

  const admin = createAdminClient();
  const password = generatePassword();

  const { error } = await admin.auth.admin.updateUserById(profileId, { password });

  if (error) {
    console.error('Could not reset password', error.message);
    return { ok: false, message: 'Could not reset the password.' };
  }

  await admin.from('profiles').update({ must_change_password: true }).eq('id', profileId);

  await admin.rpc('write_audit_log', {
    p_action: 'staff.password_reset',
    p_resource_type: 'profile',
    p_resource_id: profileId,
    p_metadata: { reset_by: session.profile.email },
  });

  revalidatePath('/people');
  return { ok: true, message: 'A new temporary password has been issued.', data: { password } };
}

/**
 * A staff member changing their own password.
 *
 * Goes through `updateUser` on the *session* client, so Supabase Auth applies
 * its own rules and the change is attributable to the signed-in user rather
 * than to an admin key.
 */
const changePasswordInput = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(200)
      // Length is what matters; a composition rule that forces "Password1!"
      // buys nothing. This only rejects the genuinely obvious.
      .refine(
        (value) => !/^(password|bcm10|12345)/i.test(value),
        'Choose something less guessable'
      ),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: 'The two passwords do not match',
    path: ['confirm'],
  });

export async function changeOwnPassword(input: unknown): Promise<ActionResult> {
  const session = await requireNewsroomUser();

  const parsed = changePasswordInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Check the password.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Clearing the flag is what lets them back into the rest of the newsroom.
  // Doing it with the admin client avoids depending on the profiles UPDATE
  // policy for a user who is, at this moment, allowed nowhere else.
  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ must_change_password: false, password_changed_at: new Date().toISOString() })
    .eq('id', session.profile.id);

  await admin.rpc('write_audit_log', {
    p_action: 'profile.password_changed',
    p_resource_type: 'profile',
    p_resource_id: session.profile.id,
    p_metadata: {},
  });

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Password updated.' };
}

function staffWelcomeHtml(params: {
  name: string;
  email: string;
  password: string;
  signInUrl: string;
}): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f4f4f5;padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:20px 24px;border-bottom:3px solid #c1272d;">
    <span style="font-size:20px;font-weight:800;color:#c1272d;">BCM10 Newsroom</span>
  </td></tr>
  <tr><td style="padding:24px;color:#18181b;font-size:15px;line-height:1.6;">
    <h1 style="margin:0 0 12px;font-size:20px;">Welcome, ${escape(params.name)}</h1>
    <p style="margin:0 0 14px;">An account has been created for you in the BCM10 newsroom.</p>
    <table role="presentation" style="margin:0 0 16px;background:#fafafa;border-radius:6px;width:100%;">
      <tr><td style="padding:14px 16px;font-family:ui-monospace,monospace;font-size:14px;">
        <div style="color:#71717a;font-size:12px;">Email</div>
        <div style="margin-bottom:10px;">${escape(params.email)}</div>
        <div style="color:#71717a;font-size:12px;">Temporary password</div>
        <div style="font-weight:700;">${escape(params.password)}</div>
      </td></tr>
    </table>
    <p style="margin:0 0 16px;">You will be asked to choose your own password the first time you sign in.</p>
    <table role="presentation"><tr><td style="background:#c1272d;border-radius:6px;">
      <a href="${escape(params.signInUrl)}" style="display:inline-block;padding:12px 24px;color:#fff;font-weight:600;text-decoration:none;">Sign in</a>
    </td></tr></table>
    <p style="margin:16px 0 0;color:#71717a;font-size:13px;">If you were not expecting this, tell the desk — do not use the password.</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}
