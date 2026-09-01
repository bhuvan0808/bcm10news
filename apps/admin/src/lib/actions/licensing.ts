'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@bcm10/database/admin';
import { createClient } from '@bcm10/database/server';
import { organizationInput } from '@bcm10/validation';
import { requireNewsroomUser } from '@/lib/auth';
import type { ActionResult } from './articles';

/**
 * B2B content licensing.
 *
 * Restricted to super admins and subscription managers — this is commercial
 * work, not editorial, and an editor has no business creating a licence.
 *
 * Organisations and licences are written with the admin client because
 * `organizations` RLS grants write only to `manages_subscriptions()`, and the
 * guard below already established that. Reads go through the session client so
 * the policy stays the thing that decides.
 */
async function requireCommercial() {
  const session = await requireNewsroomUser();

  if (session.profile.role !== 'super_admin' && session.profile.role !== 'subscription_manager') {
    throw new Error('Licensing is managed by super admins and subscription managers.');
  }

  return session;
}

const licenseFormInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2, 'Give the licence a name').max(200),
  /** Null means unlimited, which is a real plan and not a missing value. */
  quotaPerPeriod: z.number().int().positive().nullable(),
  periodEnd: z.string().optional().nullable(),
  allowFullText: z.boolean().default(true),
  allowImages: z.boolean().default(false),
  allowRepublish: z.boolean().default(false),
  allowApi: z.boolean().default(false),
  allowedCategoryIds: z.array(z.string().uuid()).default([]),
});

function orgSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `org-${Date.now().toString(36)}`
  );
}

export async function createOrganization(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireCommercial();

  const parsed = organizationInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const admin = createAdminClient();
  const org = parsed.data;

  let slug = orgSlug(org.name);
  const { data: clash } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data, error } = await admin
    .from('organizations')
    .insert({
      name: org.name,
      slug,
      billing_email: org.billingEmail,
      gstin: org.gstin ?? null,
      contact_phone: org.contactPhone ?? null,
      billing_address: org.billingAddress as never,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Could not create organisation', error.message);
    return { ok: false, message: 'Could not create that organisation.' };
  }

  revalidatePath('/licensing');
  return { ok: true, message: `${org.name} added.`, data: { id: data.id } };
}

export async function createLicense(input: unknown): Promise<ActionResult> {
  await requireCommercial();

  const parsed = licenseFormInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the licence details.' };
  }

  const license = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.from('content_licenses').insert({
    organization_id: license.organizationId,
    name: license.name,
    quota_per_period: license.quotaPerPeriod,
    period_start: new Date().toISOString(),
    period_end: license.periodEnd ? new Date(license.periodEnd).toISOString() : null,
    allow_full_text: license.allowFullText,
    allow_images: license.allowImages,
    allow_republish: license.allowRepublish,
    allow_api: license.allowApi,
    allowed_category_ids: license.allowedCategoryIds,
  });

  if (error) {
    console.error('Could not create licence', error.message);
    return { ok: false, message: 'Could not create that licence.' };
  }

  revalidatePath('/licensing');
  return { ok: true, message: 'Licence created.' };
}

export async function setLicenseActive(licenseId: string, active: boolean): Promise<ActionResult> {
  await requireCommercial();

  const admin = createAdminClient();
  const { error } = await admin
    .from('content_licenses')
    .update({ is_active: active })
    .eq('id', licenseId);

  if (error) return { ok: false, message: 'Could not update that licence.' };

  revalidatePath('/licensing');
  return { ok: true, message: active ? 'Licence reactivated.' : 'Licence suspended.' };
}

/**
 * Starts a fresh quota period.
 *
 * Deliberately manual rather than automatic. Billing periods are a commercial
 * matter — an organisation may have been invoiced late, or agreed a pause — and
 * silently resetting a quota on a timer would hide that from whoever is
 * managing the relationship.
 */
export async function resetLicensePeriod(licenseId: string): Promise<ActionResult> {
  await requireCommercial();

  const admin = createAdminClient();
  const { error } = await admin
    .from('content_licenses')
    .update({ used_this_period: 0, period_start: new Date().toISOString() })
    .eq('id', licenseId);

  if (error) return { ok: false, message: 'Could not reset the period.' };

  revalidatePath('/licensing');
  return { ok: true, message: 'Quota period reset.' };
}

/** Adds an existing reader account to an organisation. */
export async function addOrganizationMember(
  organizationId: string,
  email: string
): Promise<ActionResult> {
  await requireCommercial();

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      message: 'No account with that email. They need to sign up on the public site first.',
    };
  }

  const { error } = await admin
    .from('organization_members')
    .insert({ organization_id: organizationId, profile_id: profile.id });

  if (error) {
    return {
      ok: false,
      message: error.message.includes('duplicate')
        ? 'They are already a member.'
        : 'Could not add them.',
    };
  }

  // A licensed seat is a business customer, not a plain reader — the role is
  // what the article RLS policy checks when serving licensed content.
  if (profile.role === 'reader') {
    await admin.from('profiles').update({ role: 'business_customer' }).eq('id', profile.id);
  }

  revalidatePath('/licensing');
  return { ok: true, message: 'Member added.' };
}

export async function removeOrganizationMember(
  organizationId: string,
  profileId: string
): Promise<ActionResult> {
  await requireCommercial();

  const admin = createAdminClient();
  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('profile_id', profileId);

  if (error) return { ok: false, message: 'Could not remove them.' };

  revalidatePath('/licensing');
  return { ok: true, message: 'Member removed.' };
}

/** Usage ledger for an organisation, for invoicing and for disputes. */
export async function getLicenseUsage(
  organizationId: string,
  days = 30
): Promise<
  ActionResult<{
    rows: { article_title: string; article_slug: string; action: string; accessed_at: string }[];
  }>
> {
  await requireCommercial();

  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('license_usage')
    .select('action, accessed_at, articles(title, slug)')
    .eq('organization_id', organizationId)
    .gte('accessed_at', since)
    .order('accessed_at', { ascending: false })
    .limit(500);

  if (error) return { ok: false, message: 'Could not load usage.' };

  const rows = (data ?? []).map((row) => {
    const article = row.articles as unknown as { title: string; slug: string } | null;
    return {
      article_title: article?.title ?? 'Deleted story',
      article_slug: article?.slug ?? '',
      action: row.action,
      accessed_at: row.accessed_at,
    };
  });

  return { ok: true, data: { rows } };
}
