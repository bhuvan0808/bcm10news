import { createClient } from '@bcm10/database/server';
import type { ProfileRow } from '@bcm10/database';
import { PeopleManager } from '@/components/people-manager';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'People' };

/**
 * Staff management.
 *
 * Super admin only. RLS would return the rows to any newsroom user — colleagues
 * are visible to each other by design — but creating accounts and changing
 * roles is not something an editor should be doing.
 */
export default async function PeoplePage() {
  const session = await requireAdmin('/people');
  const supabase = await createClient();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'reader')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  const staff = (data ?? []) as ProfileRow[];

  // Story counts drive the UI's most important distinction: an account that has
  // filed something can only be deactivated, never deleted, because the byline
  // is part of the published record.
  const { data: counts } = await supabase.from('articles').select('author_id');

  const storyCounts = new Map<string, number>();
  for (const row of counts ?? []) {
    storyCounts.set(row.author_id, (storyCounts.get(row.author_id) ?? 0) + 1);
  }

  return (
    <PeopleManager
      staff={staff}
      currentUserId={session.profile.id}
      storyCounts={Object.fromEntries(storyCounts)}
    />
  );
}
