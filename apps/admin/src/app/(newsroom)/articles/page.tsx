import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { getAllCategories, listNewsroomArticles } from '@bcm10/database';
import { articleQueryInput } from '@bcm10/validation';
import { StatusBadge } from '@/components/status-badge';
import { requireNewsroomUser } from '@/lib/auth';
import { formatRelative } from '@/lib/format';
import { ADMIN } from '@/lib/site';

export const metadata = { title: 'Stories' };

const STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const;

/**
 * The story list.
 *
 * Filters narrow what RLS already permits — they never widen it. A reporter
 * who strips the author filter out of the URL still sees only their own work
 * plus what is published, because the policy decides, not the query string.
 */
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireNewsroomUser();
  const supabase = await createClient();
  const params = await searchParams;

  const parsed = articleQueryInput.safeParse({
    status: params['status'] ? [params['status']] : undefined,
    categoryId: params['category'] || undefined,
    search: params['q'] || undefined,
    page: params['page'] ?? '1',
    // Reporters default to their own work; editors default to everything.
    authorId: session.isEditorial ? params['author'] || undefined : session.profile.id,
    sort: 'updated_desc',
    perPage: 30,
  });

  const query = parsed.success
    ? parsed.data
    : { page: 1, perPage: 30, sort: 'updated_desc' as const };

  const [{ items, total, page, perPage }, categories] = await Promise.all([
    listNewsroomArticles(supabase, query),
    getAllCategories(supabase).catch(() => []),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Stories</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {total} {total === 1 ? 'story' : 'stories'}
            {session.isEditorial ? '' : ' filed by you'}
          </p>
        </div>

        <Link
          href="/articles/new"
          className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Start a story
        </Link>
      </header>

      {/* A GET form, so every filtered view is a URL an editor can send to a
          colleague. */}
      <form
        method="get"
        className="mt-5 flex flex-wrap gap-2 rounded-sm border border-rule bg-paper-raised p-3"
      >
        <input
          type="search"
          name="q"
          defaultValue={params['q'] ?? ''}
          placeholder="Search headlines…"
          aria-label="Search headlines"
          className="h-9 min-w-48 flex-1 rounded-sm border border-rule-strong bg-paper-raised px-3 text-sm"
        />

        <select
          name="status"
          defaultValue={params['status'] ?? ''}
          aria-label="Filter by status"
          className="h-9 rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
        >
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          name="category"
          defaultValue={params['category'] ?? ''}
          aria-label="Filter by section"
          className="h-9 rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
        >
          <option value="">Any section</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="h-9 rounded-sm border border-rule-strong px-4 text-sm font-semibold hover:bg-paper-sunk"
        >
          Filter
        </button>
      </form>

      {items.length ? (
        <ul className="mt-5 divide-y divide-rule rounded-sm border border-rule bg-paper-raised">
          {items.map((article) => (
            <li key={article.id}>
              <Link
                href={`/articles/${article.id}`}
                className="flex gap-3 p-3 hover:bg-paper-sunk/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={article.status} />
                    {article.is_breaking ? (
                      <span className="rounded-xs bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                        Breaking
                      </span>
                    ) : null}
                    {article.is_premium ? (
                      <span className="rounded-xs bg-premium-bg px-1.5 py-0.5 text-[10px] font-bold text-premium uppercase">
                        Premium
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 line-clamp-2 font-semibold text-ink">{article.title}</p>

                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                    {article.category?.name ? <span>{article.category.name}</span> : null}
                    {article.author?.name ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{article.author.name}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <time dateTime={article.updated_at} suppressHydrationWarning>
                      {formatRelative(article.updated_at)}
                    </time>
                    {article.word_count > 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{article.word_count} words</span>
                      </>
                    ) : null}
                  </p>
                </div>

                {article.featured_image?.storage_key ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${ADMIN.mediaBaseUrl}/${article.featured_image.storage_key}`}
                    alt=""
                    className="size-16 shrink-0 rounded-sm object-cover"
                    loading="lazy"
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-sm border border-dashed border-rule p-12 text-center">
          <p className="font-semibold text-ink">No stories match these filters</p>
          <p className="mt-1 text-sm text-ink-muted">Clear the filters, or start a new story.</p>
        </div>
      )}

      {lastPage > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex justify-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(params, page - 1)}
              rel="prev"
              className="rounded-sm border border-rule px-3 py-1.5 text-sm hover:bg-paper-sunk"
            >
              Previous
            </Link>
          ) : null}

          <span className="px-3 py-1.5 text-sm text-ink-muted">
            Page {page} of {lastPage}
          </span>

          {page < lastPage ? (
            <Link
              href={buildPageHref(params, page + 1)}
              rel="next"
              className="rounded-sm border border-rule px-3 py-1.5 text-sm hover:bg-paper-sunk"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function buildPageHref(params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') search.set(key, value);
  }
  search.set('page', String(page));
  return `/articles?${search.toString()}`;
}
