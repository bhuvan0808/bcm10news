import Link from 'next/link';

/**
 * Paywall.
 *
 * Worth being precise about what this component is and is not.
 *
 * It is *not* the paywall. The paywall is the RLS policy on `articles`: a
 * premium row is invisible to a reader without the `premium_content`
 * entitlement, so the body never reaches this process. By the time this
 * renders there is genuinely nothing to hide — no CSS trick, no truncated
 * string sitting in the DOM waiting for someone to open devtools.
 *
 * This is the message that explains why the story stopped, and the way back in.
 */
export function Paywall({
  title,
  isSignedIn,
  returnTo,
}: {
  title: string;
  isSignedIn: boolean;
  returnTo: string;
}) {
  return (
    <div className="relative mt-8">
      {/* Fade from the last visible paragraph, so the cut reads as designed
          rather than as a page that failed to load. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-linear-to-b from-transparent to-paper"
        aria-hidden="true"
      />

      <section
        aria-labelledby="paywall-heading"
        className="rounded-sm border border-rule-strong bg-paper-raised p-6 text-center sm:p-8"
      >
        <p className="kicker">Subscriber story</p>

        <h2 id="paywall-heading" className="mt-2 text-2xl font-black tracking-tight text-ink">
          Keep reading with BCM10 Premium
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
          “{title}” is available to subscribers. Your subscription pays the reporters who file these
          stories from the districts.
        </p>

        <ul className="mx-auto mt-5 grid max-w-md gap-2 text-left text-sm text-ink-muted">
          {[
            'Every premium investigation and analysis',
            'The subscriber-only morning briefing',
            'An ad-light reading experience',
          ].map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <svg
                viewBox="0 0 20 20"
                className="mt-0.5 size-4 shrink-0 fill-brand"
                aria-hidden="true"
              >
                <path d="M8 13.2 4.8 10l-1.1 1.1L8 15.4l8.4-8.4-1.1-1.1z" />
              </svg>
              {benefit}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/subscribe?from=${encodeURIComponent(returnTo)}`}
            className="w-full rounded-sm bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:w-auto"
          >
            See subscription plans
          </Link>

          {!isSignedIn ? (
            <Link
              href={`/account?from=${encodeURIComponent(returnTo)}`}
              className="w-full rounded-sm border border-rule-strong px-6 py-3 text-sm font-semibold text-ink hover:bg-paper-sunk sm:w-auto"
            >
              Already subscribed? Sign in
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
