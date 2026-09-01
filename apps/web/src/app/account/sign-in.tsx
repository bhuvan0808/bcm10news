'use client';

import { useState } from 'react';
import { createClient } from '@bcm10/database/browser';
import { Button, Field, Input, cn } from '@bcm10/ui';

/**
 * Reader sign-in.
 *
 * Unlike the newsroom, `shouldCreateUser` is true here — readers sign
 * themselves up, and the auth trigger provisions their profile with the
 * default `reader` role. There is no path from this form to a newsroom role.
 */
export function ReaderSignIn({ returnTo, className }: { returnTo: string; className?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{
    status: 'idle' | 'sending' | 'sent' | 'error';
    message?: string;
  }>({
    status: 'idle',
  });

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;

  const withGoogle = async () => {
    setState({ status: 'sending' });
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });

    if (error) setState({ status: 'error', message: error.message });
  };

  const withEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setState({ status: 'sending' });
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });

    if (error) {
      setState({ status: 'error', message: error.message });
      return;
    }

    setState({ status: 'sent' });
  };

  if (state.status === 'sent') {
    return (
      <div
        role="status"
        className={cn('rounded-sm border border-rule bg-paper-raised p-4', className)}
      >
        <p className="font-semibold text-ink">Check your email</p>
        <p className="mt-1 text-sm text-ink-muted">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={withGoogle}
        loading={state.status === 'sending'}
        className="w-full"
      >
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="text-xs tracking-wider text-ink-faint uppercase">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form onSubmit={withEmail} className="space-y-3">
        <Field label="Email" htmlFor="reader-email">
          <Input
            id="reader-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            invalid={state.status === 'error'}
          />
        </Field>

        <Button type="submit" size="lg" loading={state.status === 'sending'} className="w-full">
          Email me a link
        </Button>
      </form>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm font-medium text-brand">
          {state.message}
        </p>
      ) : null}

      <p className="text-xs text-ink-faint">
        By signing in you agree to our{' '}
        <a href="/terms" className="underline">
          terms
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline">
          privacy policy
        </a>
        .
      </p>
    </div>
  );
}
