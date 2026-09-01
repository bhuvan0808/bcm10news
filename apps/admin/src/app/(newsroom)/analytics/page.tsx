import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { requireEditorial } from '@/lib/auth';
import { TrafficChart } from '@/components/analytics/traffic-chart';
import { StatTile } from '@/components/analytics/stat-tile';
import { formatDate } from '@/lib/format';
import { ADMIN } from '@/lib/site';

export const metadata = { title: 'Analytics' };

const WINDOWS = [7, 30, 90] as const;

/**
 * Newsroom analytics.
 *
 * First-party numbers, from our own `article_views` table rather than PostHog.
 * Two reasons: an ad-blocker removes PostHog for a meaningful share of readers,
 * and an editor should not need a second vendor login to answer "how did that
 * story do".
 *
 * PostHog still owns the funnel work — read depth by cohort, conversion to
 * subscription. This answers the questions a desk asks hourly.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireEditorial('/analytics');
  const supabase = await createClient();

  const { days: rawDays } = await searchParams;
  const days = WINDOWS.includes(Number(rawDays) as (typeof WINDOWS)[number]) ? Number(rawDays) : 30;

  // Five aggregates in parallel; each is a grouped scan that stays in Postgres.
  const [summary, byDay, topArticles, byCategory, byReporter] = await Promise.all([
    supabase.rpc('site_analytics', { p_days: days }),
    supabase.rpc('views_by_day', { p_days: days }),
    supabase.rpc('top_articles', { p_days: days, p_limit: 20 }),
    supabase.rpc('category_analytics', { p_days: days }),
    supabase.rpc('reporter_analytics', { p_days: days }),
  ]);

  const stats = summary.data?.[0];
  const series = (byDay.data ?? []) as { day: string; views: number; visitors: number }[];
  const articles = (topArticles.data ?? []) as TopArticle[];
  const categories = (byCategory.data ?? []) as CategoryRow[];
  const reporters = (byReporter.data ?? []) as ReporterRow[];

  const hasTraffic = (stats?.views ?? 0) > 0;

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Readership from our own records, not a third party.
          </p>
        </div>

        <nav aria-label="Time range" className="flex rounded-sm border border-rule">
          {WINDOWS.map((window) => (
            <Link
              key={window}
              href={`/analytics?days=${window}`}
              aria-current={window === days ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm font-medium first:rounded-l-sm last:rounded-r-sm ${
                window === days ? 'bg-brand text-white' : 'text-ink-muted hover:bg-paper-sunk'
              }`}
            >
              {window}d
            </Link>
          ))}
        </nav>
      </header>

      {!hasTraffic ? (
        <div className="mt-6 rounded-sm border border-dashed border-rule p-10 text-center">
          <p className="font-semibold text-ink">No readership recorded yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Numbers appear here once published stories start being read. Views are counted from the
            live site, so nothing shows while the site is still private.
          </p>
        </div>
      ) : null}

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Page views"
          value={stats?.views ?? 0}
          previous={stats?.prev_views ?? 0}
          days={days}
        />
        <StatTile
          label="Readers"
          value={stats?.visitors ?? 0}
          previous={stats?.prev_visitors ?? 0}
          days={days}
          hint="Distinct daily-rotating hashes, not tracked individuals"
        />
        <StatTile
          label="Stories published"
          value={stats?.articles_published ?? 0}
          previous={stats?.prev_articles_published ?? 0}
          days={days}
        />
        <StatTile
          label="Average read depth"
          value={stats?.avg_read_depth ?? 0}
          suffix="%"
          days={days}
          hint="How far down the page readers get"
        />
      </section>

      {hasTraffic ? (
        <section aria-labelledby="traffic-heading" className="mt-8">
          <h2
            id="traffic-heading"
            className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
          >
            Traffic
          </h2>
          <div className="mt-4">
            <TrafficChart series={series} />
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="top-heading">
          <h2
            id="top-heading"
            className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
          >
            Most read stories
          </h2>

          {articles.length ? (
            <ol className="divide-y divide-rule">
              {articles.map((article, index) => (
                <li key={article.article_id} className="py-3">
                  <div className="flex gap-3">
                    <span
                      className="w-6 shrink-0 text-lg font-black text-rule-strong tabular-nums"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/articles/${article.article_id}/analytics`}
                        className="line-clamp-2 font-semibold text-ink hover:text-brand"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                        <span>{article.category_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{article.author_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(article.published_at)}</span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-bold text-ink tabular-nums">
                        {Number(article.views).toLocaleString('en-IN')}
                      </p>
                      {article.avg_read_depth ? (
                        <p className="text-xs text-ink-faint">{article.avg_read_depth}% read</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-sm text-ink-faint">Nothing read in this window.</p>
          )}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="sections-heading">
            <h2
              id="sections-heading"
              className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
            >
              Sections
            </h2>
            <BarList
              rows={categories
                .filter((row) => Number(row.views) > 0 || Number(row.articles) > 0)
                .map((row) => ({
                  key: row.category_id,
                  label: row.category_name,
                  value: Number(row.views),
                  meta: `${row.articles} published · ${row.views_per_article}/story`,
                }))}
              emptyMessage="No section has traffic yet."
            />
          </section>

          <section aria-labelledby="reporters-heading">
            <h2
              id="reporters-heading"
              className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
            >
              Reporters
            </h2>
            <BarList
              rows={reporters.map((row) => ({
                key: row.profile_id,
                label: row.name,
                value: Number(row.views),
                meta: `${row.published} published · ${row.drafts} in progress`,
              }))}
              emptyMessage="No reporter activity in this window."
            />
          </section>
        </div>
      </div>

      <p className="mt-10 border-t border-rule pt-4 text-xs text-ink-faint">
        Readers are counted by a hash of IP and browser that rotates daily, so the same person on
        two days counts twice and nobody is tracked across days. For funnels and retention, see
        PostHog. The public site is{' '}
        <a
          href={ADMIN.publicSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {ADMIN.publicSiteUrl.replace(/^https?:\/\//, '')}
        </a>
        .
      </p>
    </div>
  );
}

/**
 * A horizontal bar list.
 *
 * Bars are scaled against the largest row rather than against a fixed maximum,
 * so the shape stays readable whether the top row is 12 views or 120,000.
 */
function BarList({
  rows,
  emptyMessage,
}: {
  rows: { key: string; label: string; value: number; meta: string }[];
  emptyMessage: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const visible = rows.slice(0, 10);

  if (!visible.length) {
    return <p className="py-6 text-sm text-ink-faint">{emptyMessage}</p>;
  }

  return (
    <ul className="mt-2 space-y-2">
      {visible.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-ink">{row.label}</span>
            <span className="shrink-0 text-ink-muted tabular-nums">
              {row.value.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-sunk">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">{row.meta}</p>
        </li>
      ))}
    </ul>
  );
}

interface TopArticle {
  article_id: string;
  slug: string;
  title: string;
  category_name: string;
  author_name: string;
  published_at: string;
  views: number;
  visitors: number;
  avg_read_depth: number | null;
}

interface CategoryRow {
  category_id: string;
  category_slug: string;
  category_name: string;
  articles: number;
  views: number;
  views_per_article: number;
}

interface ReporterRow {
  profile_id: string;
  name: string;
  role: string;
  published: number;
  drafts: number;
  views: number;
  avg_views_per_article: number;
}
