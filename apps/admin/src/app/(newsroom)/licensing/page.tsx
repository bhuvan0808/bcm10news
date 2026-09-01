import { redirect } from 'next/navigation';
import { createClient } from '@bcm10/database/server';
import type { CategoryRow, ContentLicenseRow, OrganizationRow } from '@bcm10/database';
import { LicensingManager } from '@/components/licensing-manager';
import { requireNewsroomUser } from '@/lib/auth';

export const metadata = { title: 'Licensing' };

/**
 * B2B content licensing.
 *
 * Commercial, not editorial — a super admin or a subscription manager, and
 * nobody else. An editor with no commercial responsibility should not be able
 * to grant a company access to the archive.
 */
export default async function LicensingPage() {
  const session = await requireNewsroomUser('/licensing');

  if (session.profile.role !== 'super_admin' && session.profile.role !== 'subscription_manager') {
    redirect('/no-access');
  }

  const supabase = await createClient();

  const [orgsResult, licensesResult, categoriesResult, membersResult, usageResult] =
    await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('content_licenses').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('is_active', true).order('position'),
      supabase
        .from('organization_members')
        .select('organization_id, profile_id, profiles(email, full_name, display_name)'),
      // Usage in the last 30 days, for the per-organisation counter.
      supabase
        .from('license_usage')
        .select('organization_id')
        .gte('accessed_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    ]);

  const usageByOrg: Record<string, number> = {};
  for (const row of usageResult.data ?? []) {
    usageByOrg[row.organization_id] = (usageByOrg[row.organization_id] ?? 0) + 1;
  }

  const members = (membersResult.data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      email: string;
      full_name: string;
      display_name: string | null;
    } | null;
    return {
      organizationId: row.organization_id,
      profileId: row.profile_id,
      email: profile?.email ?? '',
      name: profile?.display_name || profile?.full_name || '',
    };
  });

  return (
    <LicensingManager
      organizations={(orgsResult.data ?? []) as OrganizationRow[]}
      licenses={(licensesResult.data ?? []) as ContentLicenseRow[]}
      categories={(categoriesResult.data ?? []) as CategoryRow[]}
      members={members}
      usageByOrg={usageByOrg}
    />
  );
}
