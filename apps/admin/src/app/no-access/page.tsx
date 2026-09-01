import Link from 'next/link';

export const metadata = { title: 'No access' };

/**
 * Shown when someone is signed in but has no newsroom role — a reader who
 * followed an admin link, or a colleague whose access has been withdrawn.
 */
export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">Newsroom</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">You do not have newsroom access</h1>
        <p className="mt-3 text-sm text-ink-muted">
          This account is signed in, but it has not been given a newsroom role. Ask an editor or the
          administrator to grant you access.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-sm border border-rule-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-paper-sunk"
          >
            Try again
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
