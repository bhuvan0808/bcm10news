import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { getNewsroomCounts, listNewsroomArticles } from '@bcm10/database';
import { StatusBadge } from '@/components/status-badge';
import { requireNewsroomUser } from '@/lib/auth';
import { formatRelative } from '@/lib/format';

export const metadata = { title: 'Dashboard' };

/**
 * The dashboard.
 *
 * One page that serves both roles, because the same question is being asked
 * from two sides: a reporter wants "what is mine and what needs my attention",
 * an editor wants "what is waiting on the desk". RLS already narrows every
 * query, so the difference between the two views is which tiles are shown, not
 * which data is fetched.
 *
 * "Needs your attention" comes first deliberately. A returned story sitting
 * unnoticed is the most expensive failure in this workflow — it is work
 * already done that is not going out.
 */
export default async function DashboardPage() {
  const session = await requireNewsroomUser();
  const supabase = await createClient();

  const [counts, needsAttention, recent, queue] = await Promise.all([
    getNewsroomCounts(supabase, session.profile.id),
    listNewsroomArticles(supabase, {
      authorId: session.profile.id,
      status: ['changes_requested'],
      perPage: 5,
    }),
    listNewsroomArticles(supabase, { authorId: session.profile.id, perPage: 8 }),
    session.isEditorial
      ? listNewsroomArticles(supabase, { status: ['submitted', 'in_review'], perPage: 8 })
      : Promise.resolve({ items: [], total: 0, page: 1, perPage: 8, hasMore: false }),
  ]);

  const firstName = (session.profile.display_name || session.profile.full_name).split(' ')[0];

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Good day, {firstName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {session.isEditorial
              ? 'Here is what the desk is holding.'
              : 'Here is where your stories stand.'}
          </p>
        </div>

        <Link
          href="/articles/new"
          className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Start a story
        </Link>
      </header>

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Tile label="My drafts" value={counts.myDrafts} href="/articles?status=draft" />
        <Tile label="With the desk" value={counts.mySubmitted} href="/articles?status=submitted" />
        <Tile
          label="Returned to me"
          value={counts.changesRequested}
          href="/articles?status=changes_requested"
          tone={counts.changesRequested > 0 ? 'alert' : 'default'}
        />
        {session.isEditorial ? (
          <>
            <Tile
              label="Awaiting review"
              value={counts.reviewQueue}
              href="/review"
              tone={counts.reviewQueue > 0 ? 'alert' : 'default'}
            />
            <Tile label="Scheduled" value={counts.scheduled} href="/schedule" />
            <Tile
              label="Published today"
              value={counts.publishedToday}
              href="/articles?status=published"
            />
          </>
        ) : null}
      </section>

      {needsAttention.items.length > 0 ? (
        <section
          aria-labelledby="attention-heading"
          className="border-status-changes/30 bg-status-changes/5 mt-8 rounded-sm border p-4"
        >
          <h2 id="attention-heading" className="text-status-changes text-sm font-bold">
            Needs your attention
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            An editor sent these back with notes. They are not going out until you resubmit them.
          </p>
          <ul className="mt-3 divide-y divide-rule">
            {needsAttention.items.map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="mine-heading">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2
              id="mine-heading"
              className="text-sm font-bold tracking-wider text-ink-muted uppercase"
            >
              My recent stories
            </h2>
            <Link href="/articles" className="text-xs font-semibold text-brand hover:underline">
              See all
            </Link>
          </div>

          {recent.items.length ? (
            <ul className="divide-y divide-rule">
              {recent.items.map((article) => (
                <ArticleRow key={article.id} article={article} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nothing filed yet"
              body="Your stories will appear here once you start one."
              action={{ href: '/articles/new', label: 'Start your first story' }}
            />
          )}
        </section>

        {session.isEditorial ? (
          <section aria-labelledby="queue-heading">
            <div className="flex items-baseline justify-between border-b border-rule pb-2">
              <h2
                id="queue-heading"
                className="text-sm font-bold tracking-wider text-ink-muted uppercase"
              >
                Waiting for review
              </h2>
              <Link href="/review" className="text-xs font-semibold text-brand hover:underline">
                Open queue
              </Link>
            </div>

            {queue.items.length ? (
              <ul className="divide-y divide-rule">
                {queue.items.map((article) => (
                  <ArticleRow key={article.id} article={article} showAuthor />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="The queue is clear"
                body="Nothing is waiting on the desk right now."
              />
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'alert';
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm border p-3 transition-colors hover:border-rule-strong ${
        tone === 'alert'
          ? 'border-status-changes/40 bg-status-changes/5'
          : 'border-rule bg-paper-raised'
      }`}
    >
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === 'alert' && value > 0 ? 'text-status-changes' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </Link>
  );
}

function ArticleRow({
  article,
  showAuthor = false,
}: {
  article: {
    id: string;
    title: string;
    status: Parameters<typeof StatusBadge>[0]['status'];
    updated_at: string;
    category: { name: string } | null;
    author?: { name: string } | null;
  };
  showAuthor?: boolean;
}) {
  return (
    <li>
      <Link href={`/articles/${article.id}`} className="block py-3 hover:bg-paper-sunk/50">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 flex-1 text-sm font-semibold text-ink">{article.title}</p>
          <StatusBadge status={article.status} className="shrink-0" />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
          {article.category?.name ? <span>{article.category.name}</span> : null}
          {showAuthor && article.author?.name ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{article.author.name}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <time dateTime={article.updated_at} suppressHydrationWarning>
            {formatRelative(article.updated_at)}
          </time>
        </p>
      </Link>
    </li>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-sm border border-dashed border-rule p-8 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-block rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
