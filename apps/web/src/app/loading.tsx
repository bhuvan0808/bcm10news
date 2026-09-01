/**
 * Route-level loading skeleton.
 *
 * Mirrors the homepage's hero-plus-grid shape so the transition into real
 * content does not jump. `animate-pulse` only — no spinner, which on a
 * content-heavy page reads as "broken" rather than "loading".
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading stories">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="aspect-16/9 w-full rounded-sm bg-paper-sunk" />
          <div className="mt-4 h-8 w-3/4 rounded-sm bg-paper-sunk" />
          <div className="mt-2 h-4 w-1/2 rounded-sm bg-paper-sunk" />
        </div>
        <div className="space-y-5 lg:col-span-5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full rounded-sm bg-paper-sunk" />
                <div className="h-4 w-2/3 rounded-sm bg-paper-sunk" />
              </div>
              <div className="size-20 shrink-0 rounded-sm bg-paper-sunk" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
