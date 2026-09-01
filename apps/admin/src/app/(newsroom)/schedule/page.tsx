import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { listNewsroomArticles } from '@bcm10/database';
import { StatusBadge } from '@/components/status-badge';
import { requireEditorial } from '@/lib/auth';
import { formatDateTime, formatSchedule } from '@/lib/format';

export const metadata = { title: 'Scheduled' };

/**
 * Scheduled stories.
 *
 * The overdue check matters more than it looks. Scheduled publishing depends
 * on a cron job hitting /api/cron/publish-scheduled; if that job stops, stories
 * silently do not go out. Surfacing "overdue" here turns a silent failure into
 * something an editor notices within minutes.
 */
export default async function SchedulePage() {
  await requireEditorial('/schedule');
  const supabase = await createClient();

  const { items } = await listNewsroomArticles(supabase, {
    status: ['scheduled'],
    sort: 'updated_desc',
    perPage: 100,
  });

  const upcoming = [...items].sort(
    (a, b) => new Date(a.scheduled_for ?? 0).getTime() - new Date(b.scheduled_for ?? 0).getTime()
  );

  const overdue = upcoming.filter(
    (article) => article.scheduled_for && new Date(article.scheduled_for).getTime() < Date.now()
  );

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Scheduled stories</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {upcoming.length} queued to publish automatically. All times are IST.
        </p>
      </header>

      {overdue.length > 0 ? (
        <div role="alert" className="mt-4 rounded-sm border border-brand/40 bg-brand-light p-3">
          <p className="text-sm font-semibold text-brand">
            {overdue.length} {overdue.length === 1 ? 'story is' : 'stories are'} past their publish
            time
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            The scheduler runs every minute. If this persists, the publish cron job is not running —
            tell an administrator to check it.
          </p>
        </div>
      ) : null}

      {upcoming.length ? (
        <ul className="mt-5 divide-y divide-rule rounded-sm border border-rule bg-paper-raised">
          {upcoming.map((article) => {
            const schedule = article.scheduled_for ? formatSchedule(article.scheduled_for) : null;

            return (
              <li key={article.id}>
                <Link href={`/articles/${article.id}`} className="block p-3 hover:bg-paper-sunk/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={article.status} />
                    {schedule?.overdue ? (
                      <span className="rounded-xs bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                        Overdue
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 font-semibold text-ink">{article.title}</p>

                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                    {article.scheduled_for ? (
                      <>
                        <time
                          dateTime={article.scheduled_for}
                          className="font-medium text-ink-muted"
                        >
                          {formatDateTime(article.scheduled_for)} IST
                        </time>
                        <span aria-hidden="true">·</span>
                        <span className={schedule?.overdue ? 'font-semibold text-brand' : ''}>
                          {schedule?.label}
                        </span>
                      </>
                    ) : null}
                    {article.author?.name ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{article.author.name}</span>
                      </>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 rounded-sm border border-dashed border-rule p-12 text-center">
          <p className="font-semibold text-ink">Nothing is scheduled</p>
          <p className="mt-1 text-sm text-ink-muted">
            Approve a story and choose Schedule to queue it for a later time.
          </p>
        </div>
      )}
    </div>
  );
}
