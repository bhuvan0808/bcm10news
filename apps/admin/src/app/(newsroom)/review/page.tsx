import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { listNewsroomArticles } from '@bcm10/database';
import { StatusBadge } from '@/components/status-badge';
import { requireEditorial } from '@/lib/auth';
import { formatRelative } from '@/lib/format';

export const metadata = { title: 'Review queue' };

/**
 * The desk queue.
 *
 * Ordered oldest-first, which is the opposite of every other list in this app
 * and is the point: a queue sorted newest-first quietly starves the story that
 * has been waiting longest. A reporter whose piece sits for two days while
 * fresher submissions jump ahead stops submitting early.
 */
export default async function ReviewQueuePage() {
  const session = await requireEditorial('/review');
  const supabase = await createClient();

  const [submitted, inReview, approved] = await Promise.all([
    listNewsroomArticles(supabase, { status: ['submitted'], sort: 'created_desc', perPage: 50 }),
    listNewsroomArticles(supabase, { status: ['in_review'], sort: 'updated_desc', perPage: 50 }),
    listNewsroomArticles(supabase, { status: ['approved'], sort: 'updated_desc', perPage: 50 }),
  ]);

  // created_desc from the query, reversed here: oldest submission first.
  const waiting = [...submitted.items].reverse();

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Review queue</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {waiting.length + inReview.items.length} waiting · {approved.items.length} approved and
          ready to publish
        </p>
      </header>

      <div className="mt-6 space-y-8">
        <QueueSection
          title="Waiting for a reviewer"
          description="Oldest first. Nobody has picked these up yet."
          items={waiting}
          emptyMessage="Nothing is waiting."
        />

        <QueueSection
          title="Being reviewed"
          description="Someone on the desk has these open."
          items={inReview.items}
          emptyMessage="No stories are under review."
        />

        <QueueSection
          title="Approved and ready"
          description={
            session.canPublish
              ? 'Cleared by the desk. Open one to publish or schedule it.'
              : 'Cleared by the desk, waiting for someone with publishing rights.'
          }
          items={approved.items}
          emptyMessage="Nothing is queued for publishing."
        />
      </div>
    </div>
  );
}

function QueueSection({
  title,
  description,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: Awaited<ReturnType<typeof listNewsroomArticles>>['items'];
  emptyMessage: string;
}) {
  return (
    <section aria-labelledby={`queue-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="border-b border-rule pb-2">
        <h2
          id={`queue-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="text-sm font-bold uppercase tracking-wider text-ink-muted"
        >
          {title} <span className="ml-1 font-normal normal-case text-ink-faint">({items.length})</span>
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">{description}</p>
      </div>

      {items.length ? (
        <ul className="divide-y divide-rule">
          {items.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.id}`} className="block py-3 hover:bg-paper-sunk/50">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={article.status} />
                  {article.is_breaking ? (
                    <span className="rounded-xs bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Breaking
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 line-clamp-2 font-semibold text-ink">{article.title}</p>

                <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                  {article.author?.name ? <span>{article.author.name}</span> : null}
                  {article.category?.name ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{article.category.name}</span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>{article.word_count} words</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={article.updated_at} suppressHydrationWarning>
                    {formatRelative(article.updated_at)}
                  </time>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-faint">{emptyMessage}</p>
      )}
    </section>
  );
}
