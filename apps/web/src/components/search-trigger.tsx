'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Header search.
 *
 * Collapsed to an icon until used, so the masthead stays clean. Submitting
 * navigates to /search rather than fetching inline: search results are a real
 * page with a shareable URL, back-button behaviour and its own metadata, and
 * a dropdown of live results would throw a query at the database on every
 * keystroke.
 */
export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // "/" focuses search, the convention readers already know from other
      // news sites — but not while they are typing in another field.
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (event.key === '/' && !typing) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm p-2 text-ink hover:bg-paper-sunk"
        aria-label="Search"
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <form onSubmit={submit} role="search" className="flex items-center gap-1">
      <label htmlFor="site-search" className="sr-only">
        Search BCM10 News
      </label>
      <input
        ref={inputRef}
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => !query && setOpen(false)}
        placeholder="Search news…"
        className="h-9 w-40 rounded-sm border border-rule-strong bg-paper-raised px-3 text-sm sm:w-56"
      />
      <button type="submit" className="rounded-sm p-2 text-ink hover:bg-paper-sunk" aria-label="Search">
        <SearchIcon />
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
