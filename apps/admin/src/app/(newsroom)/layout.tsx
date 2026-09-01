import { createClient } from '@bcm10/database/server';
import { NewsroomShell } from '@/components/newsroom-shell';
import { requireNewsroomUser } from '@/lib/auth';

/**
 * Signed-in newsroom layout.
 *
 * A route group, so sign-in and no-access render without this chrome — a
 * person with no newsroom role should never see a sidebar full of things they
 * cannot open.
 *
 * `force-dynamic` because every page under here is per-user by definition:
 * a reporter's queue is not an editor's, and caching one for the other would
 * be both wrong and a disclosure.
 */
export const dynamic = 'force-dynamic';

export default async function NewsroomLayout({ children }: { children: React.ReactNode }) {
  const session = await requireNewsroomUser();
  const supabase = await createClient();

  // Sidebar badges. RLS returns 0 to anyone who should not see a queue, so
  // these are safe to fetch unconditionally.
  const [reviewQueue, changesRequested] = await Promise.all([
    supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'in_review']),
    supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', session.profile.id)
      .eq('status', 'changes_requested'),
  ]);

  return (
    <NewsroomShell
      session={{
        profile: session.profile,
        isEditorial: session.isEditorial,
        isAdmin: session.isAdmin,
        canPublish: session.canPublish,
      }}
      counts={{
        reviewQueue: reviewQueue.count ?? 0,
        changesRequested: changesRequested.count ?? 0,
      }}
    >
      {children}
    </NewsroomShell>
  );
}
