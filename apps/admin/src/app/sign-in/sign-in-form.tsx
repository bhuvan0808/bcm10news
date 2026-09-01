'use client';

import { useState } from 'react';
import { createClient } from '@bcm10/database/browser';
import { Button, Field, Input } from '@bcm10/ui';

/**
 * Sign-in.
 *
 * Two routes in, both passwordless:
 *
 *  • Google, for staff on newsroom accounts. It is what most reporters
 *    already have, and it moves password policy to Google.
 *  • A magic link, for anyone whose email is not on Google Workspace, and as
 *    the fallback when OAuth is misconfigured.
 *
 * There is no password field on purpose. A shared newsroom laptop and a
 * remembered password is the most common way newsroom accounts leak.
 */
export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({
    status: 'idle',
  });

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const signInWithGoogle = async () => {
    setState({ status: 'sending' });
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(),
        // Ask for a refresh token and let the reporter pick an account —
        // many have a personal and a work Google identity on one browser.
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });

    if (error) setState({ status: 'error', message: error.message });
  };

  const sendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setState({ status: 'sending' });
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl(),
        // Newsroom accounts are created by an editor, not by self-signup.
        shouldCreateUser: false,
      },
    });

    if (error) {
      setState({ status: 'error', message: error.message });
      return;
    }

    setState({ status: 'sent' });
  };

  if (state.status === 'sent') {
    return (
      <div role="status" className="text-center">
        <h2 className="text-base font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-ink-muted">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>. It expires in an
          hour.
        </p>
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-4 text-sm font-medium text-brand hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={signInWithGoogle}
        loading={state.status === 'sending'}
        className="w-full"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.8 11.8 0 0 0 12 24Z"
          />
          <path fill="#FBBC05" d="M5.6 14.7a7 7 0 0 1 0-4.5v-3H1.8a11.8 11.8 0 0 0 0 10.6l3.8-3Z" />
          <path
            fill="#EA4335"
            d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.2-3.2A11.7 11.7 0 0 0 1.8 7.2l3.8 3C6.5 6.8 9 4.8 12 4.8Z"
          />
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="text-xs uppercase tracking-wider text-ink-faint">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-3">
        <Field label="Work email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reporter@bcm10news.in"
            autoComplete="email"
            required
            invalid={state.status === 'error'}
          />
        </Field>

        <Button type="submit" size="lg" loading={state.status === 'sending'} className="w-full">
          Email me a sign-in link
        </Button>
      </form>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm font-medium text-brand">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
