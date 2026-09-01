/**
 * Loading skeleton for search.
 *
 * Deliberately scoped to this route rather than sitting at the app root.
 *
 * A root-level `loading.tsx` applies to every route beneath it, which makes
 * them all stream: the 200 headers flush before the page body runs, so a later
 * `notFound()` can swap the UI but not the status. Every dynamic route was
 * returning HTTP 200 with 404 content — a soft 404, which Google treats as a
 * quality problem and which wastes crawl budget on a large archive.
 *
 * Search cannot 404 (an unmatched query is a valid empty result), so streaming
 * is safe here and the skeleton is worth having.
 */
export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse" aria-busy="true" aria-label="Searching">
      <div className="h-9 w-32 rounded-sm bg-paper-sunk" />
      <div className="mt-4 h-11 w-full rounded-sm bg-paper-sunk" />

      <div className="mt-8 space-y-5">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 rounded-sm bg-paper-sunk" />
              <div className="h-5 w-3/4 rounded-sm bg-paper-sunk" />
              <div className="h-4 w-full rounded-sm bg-paper-sunk" />
            </div>
            <div className="size-24 shrink-0 rounded-sm bg-paper-sunk" />
          </div>
        ))}
      </div>
    </div>
  );
}
