'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@bcm10/ui';
import { changeOwnPassword } from '@/lib/actions/people';

/**
 * Password change form.
 *
 * The strength meter measures length and variety rather than enforcing a
 * composition rule. Rules like "one capital, one symbol" reliably produce
 * `Password1!` — length is what actually resists guessing, so that is what the
 * meter rewards.
 */
export function PasswordForm({ isFirstRun }: { isFirstRun: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const strength = scorePassword(password);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      const response = await changeOwnPassword({ password, confirm });

      if (response.ok) {
        setResult({ ok: true, message: 'Password updated.' });
        setPassword('');
        setConfirm('');
        // Straight to work — the gate that sent them here is now cleared.
        router.push('/');
        router.refresh();
      } else {
        setResult({ ok: false, message: response.message ?? 'Could not update the password.' });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="New password" htmlFor="new-password">
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          minLength={10}
          autoFocus
        />
      </Field>

      {password ? (
        <div>
          <div
            className="flex h-1 gap-1"
            role="progressbar"
            aria-valuenow={strength.score}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-label="Password strength"
          >
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`h-full flex-1 rounded-full ${
                  index < strength.score ? strength.colour : 'bg-rule'
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-muted">{strength.label}</p>
        </div>
      ) : null}

      <Field
        label="Confirm new password"
        htmlFor="confirm-password"
        error={confirm && confirm !== password ? 'The two do not match' : null}
      >
        <Input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
          invalid={Boolean(confirm) && confirm !== password}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={password.length < 10 || password !== confirm}
        className="w-full"
      >
        {isFirstRun ? 'Set my password and continue' : 'Update password'}
      </Button>

      {result ? (
        <p
          role="alert"
          className={`text-sm font-medium ${result.ok ? 'text-status-published' : 'text-brand'}`}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}

function scorePassword(password: string): { score: number; label: string; colour: string } {
  if (!password) return { score: 0, label: '', colour: 'bg-rule' };

  let score = 0;
  // Length dominates, because it is what actually matters.
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (password.length >= 20) score += 1;
  // A little credit for variety, but never as a requirement.
  if (/[^a-zA-Z]/.test(password) && /[a-zA-Z]/.test(password)) score += 1;

  const labels = [
    { label: 'Too short', colour: 'bg-brand' },
    { label: 'Weak — make it longer', colour: 'bg-brand' },
    { label: 'Reasonable', colour: 'bg-status-changes' },
    { label: 'Good', colour: 'bg-status-approved' },
    { label: 'Strong', colour: 'bg-status-published' },
  ];

  const entry = labels[score] ?? labels[0]!;
  return { score, label: entry.label, colour: entry.colour };
}
