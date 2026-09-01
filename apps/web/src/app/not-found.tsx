import Link from 'next/link';

/**
 * 404.
 *
 * Offers a way onward rather than a dead end — on a news site most 404s are a
 * mistyped or expired link, and the reader still wants today's news.
 */
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="kicker">Error 404</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-ink">This page has moved on</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        The story you are looking for may have been removed, renamed, or never existed.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-sm bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Go to the front page
        </Link>
        <Link
          href="/search"
          className="rounded-sm border border-rule-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-paper-sunk"
        >
          Search the archive
        </Link>
      </div>
    </div>
  );
}
