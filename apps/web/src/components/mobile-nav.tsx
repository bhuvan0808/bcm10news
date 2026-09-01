'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { NavCategory } from '@bcm10/database';
import { localised } from '@/lib/format';
import { categoryPath } from '@/lib/site';

/**
 * Mobile section drawer.
 *
 * Most BCM10 readers arrive on a phone, so this is the primary navigation, not
 * a fallback. Three behaviours it gets right that a naive drawer does not:
 * it closes on route change, it closes on Escape, and it locks body scroll
 * while open so the page behind does not scroll under the reader's finger.
 */
export function MobileNav({
  navigation,
  locale = 'te',
}: {
  navigation: NavCategory[];
  locale?: 'te' | 'en';
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Navigating away must dismiss the drawer, or the reader lands on the new
  // page with the menu still covering it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-1 rounded-sm p-2 text-ink hover:bg-paper-sunk md:hidden"
        aria-label="Open sections menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sections"
            className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-paper shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-rule px-4 py-3">
              <span className="text-xl font-black tracking-tight text-brand">BCM10</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm p-2 text-ink hover:bg-paper-sunk"
                aria-label="Close menu"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <ul className="space-y-0.5">
                {navigation.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={categoryPath(category.slug)}
                      className="block rounded-sm px-3 py-2.5 text-base font-semibold text-ink hover:bg-paper-sunk"
                    >
                      {localised(category.name, category.name_te, locale)}
                    </Link>

                    {category.children.length > 0 ? (
                      <ul className="ml-3 border-l border-rule pl-2">
                        {category.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={categoryPath(child.slug)}
                              className="block rounded-sm px-3 py-2 text-sm text-ink-muted hover:bg-paper-sunk"
                            >
                              {localised(child.name, child.name_te, locale)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-rule p-4">
              <Link
                href="/subscribe"
                className="block rounded-sm bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Subscribe
              </Link>
              <Link
                href="/account"
                className="mt-2 block rounded-sm border border-rule-strong px-4 py-2.5 text-center text-sm font-semibold text-ink"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
