import { SignInForm } from './sign-in-form';

export const metadata = {
  title: 'Sign in — BCM10 Newsroom',
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  'missing-code': 'That sign-in link was incomplete. Please request a new one.',
  'exchange-failed': 'That sign-in link has expired or was already used.',
  'no-profile': 'Your account exists but has no profile. Contact the administrator.',
  deactivated: 'This account has been deactivated. Contact the administrator.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? 'Sign-in failed. Please try again.') : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* The wordmark is the page's heading, not decoration: this was the
              only page in either app with no h1, so a screen-reader user
              landing here had nothing to orient on. */}
          <h1 className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-black tracking-tight text-brand">BCM10</span>
            <span className="text-xl font-semibold tracking-tight text-ink">Newsroom</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Sign in to file and edit stories.</p>
        </div>

        {message ? (
          <div
            role="alert"
            className="mb-4 rounded-sm border border-brand/30 bg-brand-light p-3 text-sm text-ink"
          >
            {message}
          </div>
        ) : null}

        <div className="rounded-sm border border-rule bg-paper-raised p-6">
          <SignInForm next={next ?? '/'} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Access is granted by an editor. If you cannot sign in, ask the desk.
        </p>
      </div>
    </div>
  );
}
