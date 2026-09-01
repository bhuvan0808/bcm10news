'use client';

import { useState } from 'react';
import { Button, Input, cn } from '@bcm10/ui';

type State = { status: 'idle' | 'submitting' | 'done' | 'error'; message?: string };

/**
 * Newsletter sign-up.
 *
 * Two details that matter:
 *
 *  • The honeypot field is visually hidden but not `display:none` — bots that
 *    parse styles skip hidden inputs, while ones that fill every field trip it.
 *    It is `tabIndex={-1}` and `aria-hidden`, so no real person reaches it.
 *  • The success message is announced with `role="status"`, so a screen-reader
 *    user learns the sign-up worked rather than watching the button change.
 */
export function NewsletterForm({
  source = 'website',
  className,
}: {
  source?: string;
  className?: string;
}) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state.status === 'submitting') return;

    setState({ status: 'submitting' });

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, website, kinds: ['daily_digest'] }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({ status: 'error', message: payload.message ?? 'Something went wrong. Try again.' });
        return;
      }

      setState({ status: 'done', message: payload.message ?? 'Check your inbox to confirm.' });
      setEmail('');
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' });
    }
  };

  if (state.status === 'done') {
    return (
      <p role="status" className={cn('rounded-sm bg-brand-light p-3 text-sm text-ink', className)}>
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <label htmlFor={`newsletter-email-${source}`} className="sr-only">
          Email address
        </label>
        <Input
          id={`newsletter-email-${source}`}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          invalid={state.status === 'error'}
        />
        <Button type="submit" loading={state.status === 'submitting'} className="shrink-0">
          Subscribe
        </Button>
      </div>

      {/* Honeypot. Off-screen rather than display:none so naive bots fill it. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={`website-${source}`}>Leave this field empty</label>
        <input
          id={`website-${source}`}
          type="text"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-ink-faint">Free. Unsubscribe any time.</p>
      )}
    </form>
  );
}
