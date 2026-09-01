import { PasswordForm } from './password-form';
import { requireNewsroomUser } from '@/lib/auth';

export const metadata = { title: 'Change your password' };

/**
 * Password change.
 *
 * Uses requireNewsroomUser rather than the gated variant on purpose — this is
 * the one page an account on a temporary password must be able to reach.
 */
export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const session = await requireNewsroomUser('/account/password');
  const { first } = await searchParams;
  const isFirstRun = first === '1' || session.mustChangePassword;

  return (
    <div className="mx-auto max-w-md">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {isFirstRun ? 'Choose your password' : 'Change your password'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isFirstRun
            ? 'Your account was set up with a temporary password. Pick your own before you start — the temporary one has been seen by whoever created your account.'
            : 'Signed in as ' + session.profile.email + '.'}
        </p>
      </header>

      <div className="mt-6 rounded-sm border border-rule bg-paper-raised p-5">
        <PasswordForm isFirstRun={isFirstRun} />
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Use at least 10 characters. A short phrase you will remember beats a short string of symbols
        you will write down.
      </p>
    </div>
  );
}
