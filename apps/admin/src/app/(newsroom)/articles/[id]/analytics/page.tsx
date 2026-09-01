import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@bcm10/database/server';
import { StatTile } from '@/components/analytics/stat-tile';
import { ArticleTrendChart } from '@/components/analytics/article-trend-chart';
import { requireNewsroomUserWithPassword } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { publicArticleUrl } from '@/lib/site';

export const metadata = { title: 'Story analytics' };

const WINDOWS = [7, 30, 90];

/**
 * How one story performed.
 *
 * A reporter can open this for their own work — that is the point of showing it
 * at all, since it is how anyone learns which headlines and openings hold a
 * reader. The RPC enforces the boundary: editorial sees every story, a reporter
 * sees only their own byline.
 */
export default async function ArticleAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  await requireNewsroomUserWithPassword(`/articles/${id}/analytics`);

  const { days: rawDays } = await searchParams;
  const days = WINDOWS.includes(Number(rawDays)) ? Number(rawDays) : 30;

  const supabase = await createClient();

  const [{ data: article }, { data: analytics, error }] = await Promise.all([
    supabase
      .from('articles')
      .select('id, slug, title, status, published_at, reading_time_minutes, word_count')
      .eq('id', id)
      .maybeSingle(),
    supabase.rpc('article_analytics', { p_article: id, p_days: days }),
  ]);

  if (!article) notFound();

  const stats = (analytics ?? {}) as ArticleStats;
  const byDay = stats.by_day ?? [];

  return (
    <div className="mx-auto max-w-(--container-page)">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-faint">
        <Link href="/analytics" className="hover:text-brand">
          Analytics
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/articles/${id}`} className="hover:text-brand">
          Story
        </Link>
      </nav>

      <header className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink">{article.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
            <span>{article.status}</span>
            {article.published_at ? (
              <>
                <span aria-hidden="true">·</span>
                <span>published {formatDateTime(article.published_at)}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{article.word_count} words</span>
          </p>
        </div>

        <div className="flex gap-2">
          <nav aria-label="Time range" className="flex rounded-sm border border-rule">
            {WINDOWS.map((window) => (
              <Link
                key={window}
                href={`/articles/${id}/analytics?days=${window}`}
                aria-current={window === days ? 'page' : undefined}
                className={`px-3 py-1.5 text-sm font-medium first:rounded-l-sm last:rounded-r-sm ${
                  window === days ? 'bg-brand text-white' : 'text-ink-muted hover:bg-paper-sunk'
                }`}
              >
                {window}d
              </Link>
            ))}
          </nav>

          {article.status === 'published' ? (
            <a
              href={publicArticleUrl(article.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm border border-rule px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-sunk"
            >
              View ↗
            </a>
          ) : null}
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-sm border border-brand/30 bg-brand-light p-3 text-sm"
        >
          {error.message}
        </p>
      ) : null}

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Views in window" value={stats.window_views ?? 0} days={days} />
        <StatTile label="Views all time" value={stats.total_views ?? 0} />
        <StatTile
          label="Readers"
          value={stats.visitors ?? 0}
          hint="Distinct daily-rotating hashes"
        />
        <StatTile
          label="Average read depth"
          value={stats.avg_read_depth ?? 0}
          suffix="%"
          hint={`Story takes about ${article.reading_time_minutes} min`}
        />
      </section>

      {byDay.some((point) => point.views > 0) ? (
        <section aria-labelledby="trend-heading" className="mt-8">
          <h2
            id="trend-heading"
            className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
          >
            Views per day
          </h2>
          <div className="mt-4">
            <ArticleTrendChart series={byDay} />
          </div>
        </section>
      ) : (
        <p className="mt-8 rounded-sm border border-dashed border-rule p-8 text-center text-sm text-ink-muted">
          No reads recorded in this window.
        </p>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section aria-labelledby="referrer-heading">
          <h2
            id="referrer-heading"
            className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
          >
            Where readers came from
          </h2>
          <SimpleBars
            rows={(stats.by_referrer ?? []).map((row) => ({
              key: row.host,
              label: row.host === 'direct' ? 'Direct or app' : row.host,
              value: row.views,
            }))}
            empty="No referrer data yet."
          />
        </section>

        <section aria-labelledby="device-heading">
          <h2
            id="device-heading"
            className="border-b border-rule pb-2 text-sm font-bold tracking-wider text-ink-muted uppercase"
          >
            Devices
          </h2>
          <SimpleBars
            rows={(stats.by_device ?? []).map((row) => ({
              key: row.device,
              label: row.device,
              value: row.views,
            }))}
            empty="No device data yet."
          />
        </section>
      </div>
    </div>
  );
}

function SimpleBars({
  rows,
  empty,
}: {
  rows: { key: string; label: string; value: number }[];
  empty: string;
}) {
  if (!rows.length) return <p className="py-6 text-sm text-ink-faint">{empty}</p>;

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="mt-2 space-y-2">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-ink capitalize">{row.label}</span>
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
        </li>
      ))}
    </ul>
  );
}

interface ArticleStats {
  total_views?: number;
  window_views?: number;
  visitors?: number;
  avg_read_depth?: number | null;
  by_day?: { day: string; views: number }[];
  by_referrer?: { host: string; views: number }[];
  by_device?: { device: string; views: number }[];
}
