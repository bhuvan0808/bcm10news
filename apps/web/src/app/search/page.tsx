import type { Metadata } from 'next';
import Link from 'next/link';
import { searchInput } from '@bcm10/validation';
import { MediaImage, ImageFallback } from '@/components/media-image';
import { Pagination } from '@/components/pagination';
import { runSearch } from '@/lib/data';
import { listMetadata } from '@/lib/seo';
import { articlePath, categoryPath } from '@/lib/site';
import { formatRelative, readingTimeLabel } from '@/lib/format';

/**
 * Search results.
 *
 * Rendered dynamically — the key space is unbounded, so caching per query
 * would fill the cache with single-use entries.
 *
 * `noindex` on results pages is deliberate: search-results-as-content is a
 * thin-content pattern Google penalises, and these pages add nothing an
 * archive page does not already provide.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...listMetadata({
    title: 'Search',
    description: 'Search the BCM10 News archive.',
    path: '/search',
    noindex: true,
  }),
};

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = searchInput.safeParse({
    q: raw.q ?? '',
    category: raw.category,
    page: raw.page ?? '1',
  });

  if (!parsed.success) return <SearchShell query={raw.q ?? ''}>{<EmptyPrompt />}</SearchShell>;

  const { q, category, page } = parsed.data;
  const results = await runSearch(q, { category, page });

  return (
    <SearchShell query={q}>
      <p className="mt-4 text-sm text-ink-muted" role="status">
        {results.total === 0
          ? `No stories match “${q}”.`
          : `${results.total.toLocaleString('en-IN')} ${results.total === 1 ? 'story' : 'stories'} matching “${q}”`}
      </p>

      {results.items.length ? (
        <ol className="mt-6 divide-y divide-rule">
          {results.items.map((hit) => (
            <li key={hit.id} className="py-5 first:pt-0">
              <Link href={articlePath(hit.slug)} className="group flex gap-4">
                <div className="min-w-0 flex-1">
                  <span className="kicker">{hit.category_name}</span>
                  <h2 className="clamp-2 mt-1 text-lg font-bold leading-snug text-ink group-hover:text-brand">
                    {hit.title}
                  </h2>
                  {hit.excerpt ? (
                    <p className="clamp-2 mt-1.5 text-sm text-ink-muted">{hit.excerpt}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                    <span>{hit.author_name}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={hit.published_at} suppressHydrationWarning>
                      {formatRelative(hit.published_at)}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{readingTimeLabel(hit.reading_time_minutes)}</span>
                  </div>
                </div>

                <div className="relative size-24 shrink-0 overflow-hidden rounded-sm bg-paper-sunk">
                  {hit.featured_image_key ? (
                    <MediaImage
                      storageKey={hit.featured_image_key}
                      alt=""
                      width={200}
                      height={200}
                      sizeName="thumb"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageFallback className="size-full" />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <NoResults query={q} />
      )}

      <Pagination
        page={results.page}
        perPage={results.perPage}
        total={results.total}
        basePath={`/search?q=${encodeURIComponent(q)}`}
        className="mt-10"
      />
    </SearchShell>
  );
}

function SearchShell({ query, children }: { query: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-black tracking-tight text-ink">Search</h1>

      {/* A GET form, so a result page is a real, shareable URL. */}
      <form action="/search" method="get" role="search" className="mt-4 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search stories
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search headlines, topics, reporters…"
          className="h-11 flex-1 rounded-sm border border-rule-strong bg-paper-raised px-4 text-base"
          autoFocus={!query}
        />
        <button
          type="submit"
          className="rounded-sm bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Search
        </button>
      </form>

      {children}
    </div>
  );
}

function EmptyPrompt() {
  return (
    <p className="mt-6 text-ink-muted">
      Enter at least two characters. You can search in Telugu or English.
    </p>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="mt-8 rounded-sm border border-rule bg-paper-raised p-6">
      <p className="font-semibold text-ink">Nothing found for “{query}”.</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        <li>Check the spelling, or try fewer words.</li>
        <li>Try the Telugu spelling if you searched in English, or the other way round.</li>
        <li>
          Browse a section instead — <Link href={categoryPath('latest-news')} className="text-brand hover:underline">latest news</Link>.
        </li>
      </ul>
    </div>
  );
}
