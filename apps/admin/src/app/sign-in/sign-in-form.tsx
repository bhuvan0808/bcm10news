'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@bcm10/database/browser';
import { Button, Field, Input } from '@bcm10/ui';

/**
 * Newsroom sign-in.
 *
 * Three ways in, in the order they matter to this newsroom:
 *
 *  • Email and password — how a reporter whose account an editor created signs
 *    in. They are made to replace the temporary password on first use.
 *  • Google — for staff on Google accounts, once OAuth is configured.
 *  • Magic link — the fallback when someone has forgotten their password and
 *    the desk is not around to reset it.
 *
 * There is no self-service sign-up. `shouldCreateUser: false` on the magic link
 * means an unknown address gets nothing, so the newsroom cannot be joined by
 * anyone an editor has not added.
 */
type Mode = 'password' | 'link';
type Status = 'idle' | 'working' | 'sent' | 'error';

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const signInWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('working');
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Deliberately vague: naming which half was wrong tells an attacker
      // which addresses have newsroom accounts.
      setStatus('error');
      setMessage(
        error.message.toLowerCase().includes('invalid')
          ? 'That email and password do not match.'
          : error.message
      );
      return;
    }

    // A full navigation, not router.push: the session cookie was just written
    // and the server layout has to re-read it to decide where this person goes.
    router.push(next);
    router.refresh();
  };

  const signInWithGoogle = async () => {
    setStatus('working');
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(),
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
    }
  };

  const sendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus('working');
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false },
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('sent');
  };

  if (status === 'sent') {
    return (
      <div role="status" className="text-center">
        <h2 className="text-base font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-ink-muted">
          If <strong className="text-ink">{email}</strong> has a newsroom account, a sign-in link is
          on its way. It expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('idle');
            setMode('password');
          }}
          className="mt-4 text-sm font-medium text-brand hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {mode === 'password' ? (
        <form onSubmit={signInWithPassword} className="space-y-3">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="reporter@bcm10news.in"
              autoComplete="username"
              required
              invalid={status === 'error'}
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              invalid={status === 'error'}
            />
          </Field>

          <Button type="submit" size="lg" loading={status === 'working'} className="w-full">
            Sign in
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode('link');
              setStatus('idle');
              setMessage(null);
            }}
            className="w-full text-center text-sm text-ink-muted hover:text-brand"
          >
            Forgotten your password? Email me a link instead
          </button>
        </form>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <Field
            label="Email"
            htmlFor="email-link"
            hint="We will send a one-time sign-in link to this address."
          >
            <Input
              id="email-link"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="reporter@bcm10news.in"
              autoComplete="username"
              required
              invalid={status === 'error'}
            />
          </Field>

          <Button type="submit" size="lg" loading={status === 'working'} className="w-full">
            Email me a sign-in link
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode('password');
              setStatus('idle');
              setMessage(null);
            }}
            className="w-full text-center text-sm text-ink-muted hover:text-brand"
          >
            Use a password instead
          </button>
        </form>
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="text-xs tracking-wider text-ink-faint uppercase">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={signInWithGoogle}
        loading={status === 'working'}
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

      {status === 'error' && message ? (
        <p role="alert" className="text-sm font-medium text-brand">
          {message}
        </p>
      ) : null}
    </div>
  );
}
