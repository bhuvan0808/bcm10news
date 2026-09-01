import { createClient } from '@bcm10/database/server';
import { MediaGrid } from '@/components/media-grid';
import { requireNewsroomUser } from '@/lib/auth';

export const metadata = { title: 'Media library' };

const PER_PAGE = 48;

/**
 * The media library.
 *
 * Photographers get a home here even though they never publish an article —
 * that is the whole point of the role. Uploading, tagging and crediting
 * pictures is newsroom work in its own right.
 *
 * RLS gives newsroom users the full library and the public only assets that
 * have appeared on a published story, so this page needs no visibility logic.
 */
export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; mine?: string }>;
}) {
  const session = await requireNewsroomUser('/media');
  const supabase = await createClient();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const offset = (page - 1) * PER_PAGE;

  let query = supabase
    .from('media')
    .select('*', { count: 'exact' })
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  if (params.mine === '1') query = query.eq('uploaded_by', session.profile.id);

  if (params.q) {
    // Escape LIKE wildcards so a search for "50%" does not match everything.
    const escaped = params.q.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(
      `title.ilike.%${escaped}%,alt_text.ilike.%${escaped}%,caption.ilike.%${escaped}%,credit.ilike.%${escaped}%`
    );
  }

  const { data, count } = await query;

  return (
    <div className="mx-auto max-w-(--container-page)">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Media library</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {(count ?? 0).toLocaleString('en-IN')} images
          </p>
        </div>
      </header>

      <form method="get" className="mt-5 flex flex-wrap gap-2 rounded-sm border border-rule bg-paper-raised p-3">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search captions, credits, alt text…"
          aria-label="Search media"
          className="h-9 min-w-48 flex-1 rounded-sm border border-rule-strong bg-paper-raised px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={params.mine === '1'}
            className="size-4 accent-[var(--color-brand)]"
          />
          Only mine
        </label>
        <button
          type="submit"
          className="h-9 rounded-sm border border-rule-strong px-4 text-sm font-semibold hover:bg-paper-sunk"
        >
          Search
        </button>
      </form>

      <MediaGrid items={data ?? []} page={page} perPage={PER_PAGE} total={count ?? 0} />
    </div>
  );
}
