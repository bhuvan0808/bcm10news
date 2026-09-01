'use client';

import { useEffect } from 'react';

/**
 * Route error boundary.
 *
 * Logs to the console (and to Sentry once its DSN is set) but shows the reader
 * a plain apology and a retry. `error.digest` is the server-side correlation
 * id — surfacing it lets a reader quote something useful in a support message
 * without exposing a stack trace.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="py-20 text-center">
      <p className="kicker">Something went wrong</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">
        We could not load this page
      </h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        This is our fault, not yours. Try again in a moment.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-sm bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Try again
      </button>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-ink-faint">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
