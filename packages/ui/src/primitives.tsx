import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Shared primitives.
 *
 * Kept small on purpose. The public site and the newsroom CMS look nothing
 * alike — one is a newspaper, the other a production tool — so only the pieces
 * whose *behaviour* must match (focus handling, disabled states, sizing
 * scales) live here. Visual identity belongs to each app.
 */

const BUTTON_VARIANTS = {
  // `brand-solid`, not `brand`: in dark mode `brand` lightens so it stays
  // legible as text, which drops white-on-red to 3.65:1. See globals.css.
  primary: 'bg-brand-solid text-white hover:bg-brand-solid-hover',
  secondary: 'bg-paper-sunk text-ink hover:bg-rule',
  outline: 'border border-rule-strong text-ink hover:bg-paper-sunk',
  ghost: 'text-ink hover:bg-paper-sunk',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} as const;

// Heights are min-heights so a button that wraps to two lines on a narrow
// phone grows instead of clipping its own label.
const BUTTON_SIZES = {
  sm: 'min-h-8 px-3 py-1.5 text-sm',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-12 px-6 py-2.5 text-base',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // A loading button must not be clickable twice — double-submitting a
      // publish or a payment is the failure this prevents.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
      />
    </svg>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        // 16px on mobile, not 14px: iOS Safari zooms the whole page when a
        // field smaller than 16px takes focus, and the reporter filing from a
        // phone then has to pinch back out.
        'h-11 w-full rounded-sm border bg-paper-raised px-3 text-base text-ink sm:h-10 sm:text-sm',
        'placeholder:text-ink-faint',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-red-500' : 'border-rule-strong',
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'premium' | 'live' | 'muted';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-paper-sunk text-ink-muted',
    brand: 'bg-brand-solid text-white',
    premium: 'bg-premium-bg text-premium',
    live: 'bg-green-600 text-white',
    muted: 'bg-transparent text-ink-faint border border-rule',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs px-1.5 py-0.5 text-[11px] font-bold tracking-wider uppercase',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Field wrapper. Ties label, error and hint to the control with real ids so a
 * screen reader announces the error rather than leaving a mystery red border.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? (
          <>
            {/* The asterisk is decoration — screen readers do not reliably
                announce it, and a red glyph conveys nothing to someone who
                cannot see it. The visually hidden word is what actually gets
                read out. */}
            <span className="ml-0.5 text-brand" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>

      <div aria-describedby={cn(hintId, errorId) || undefined}>{children}</div>

      {hint ? (
        <p id={hintId} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
