'use client';

import { useState } from 'react';
import type { ArticleContext } from '@bcm10/analytics';
import { capture } from '@bcm10/analytics/client';
import { cn } from '@bcm10/ui';

/**
 * Share controls.
 *
 * WhatsApp is first, not an afterthought: it is how news actually circulates
 * in Andhra Pradesh and Telangana, and burying it behind a "more" menu would
 * cost the newsroom its largest distribution channel.
 *
 * The native share sheet is used when the browser has one — on a phone it is
 * both faster and more capable than any list of links we can render.
 */
export function ShareBar({
  url,
  title,
  context,
  className,
}: {
  url: string;
  title: string;
  context: ArticleContext;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const track = (channel: string) => capture('article_share', { ...context, channel });

  const nativeShare = async () => {
    if (!navigator.share) return false;
    try {
      await navigator.share({ title, url });
      track('native');
      return true;
    } catch {
      // The reader dismissed the sheet. Not an error.
      return true;
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track('copy');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable (insecure context or denied); the visible
      // share links still work, so fail quietly.
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">Share</span>

      <ShareLink
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        label="Share on WhatsApp"
        onClick={() => track('whatsapp')}
        className="bg-[#25D366] text-white hover:brightness-95"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
          <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1s-.7 1-.9 1.2c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.4.1-.6l.4-.5c.2-.2.2-.3.3-.5v-.5c0-.2-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.4.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Z" />
        </svg>
        WhatsApp
      </ShareLink>

      <ShareLink
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        label="Share on Facebook"
        onClick={() => track('facebook')}
        className="bg-[#1877F2] text-white hover:brightness-95"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
        </svg>
        Facebook
      </ShareLink>

      <ShareLink
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        label="Share on X"
        onClick={() => track('twitter')}
        className="bg-ink text-paper hover:opacity-90"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
          <path d="M18.9 2H22l-6.8 7.8L23 22h-6.4l-5-6.5L5.8 22H2.7l7.3-8.3L1.6 2H8l4.5 6zM17.8 20h1.7L7.3 3.8H5.4z" />
        </svg>
        X
      </ShareLink>

      <button
        type="button"
        onClick={async () => {
          const shared = await nativeShare();
          if (!shared) await copyLink();
        }}
        className="inline-flex items-center gap-1.5 rounded-sm border border-rule-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-sunk"
        aria-live="polite"
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}

function ShareLink({
  href,
  label,
  onClick,
  className,
  children,
}: {
  href: string;
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold',
        className
      )}
    >
      {children}
    </a>
  );
}
