'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@bcm10/ui';
import type { NewsroomSession } from '@/lib/auth';
import { ADMIN } from '@/lib/site';

/**
 * Newsroom chrome.
 *
 * The sidebar collapses to a drawer below `lg`, because a reporter filing from
 * a phone needs the whole screen for the story, not a permanent nav rail.
 *
 * Navigation is filtered by role rather than rendered-and-disabled: showing a
 * reporter a "Review queue" they cannot open is noise, and a link that 403s is
 * worse than a link that is not there.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Minimum capability required to see this item. */
  requires?: 'editorial' | 'admin';
  badgeKey?: 'reviewQueue' | 'changesRequested';
}

export function NewsroomShell({
  session,
  counts,
  children,
}: {
  session: Pick<NewsroomSession, 'profile' | 'isEditorial' | 'isAdmin' | 'canPublish'>;
  counts: { reviewQueue: number; changesRequested: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const items: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: <IconHome /> },
    { href: '/articles', label: 'Stories', icon: <IconDocument /> },
    { href: '/articles/new', label: 'New story', icon: <IconPlus /> },
    {
      href: '/review',
      label: 'Review queue',
      icon: <IconInbox />,
      requires: 'editorial',
      badgeKey: 'reviewQueue',
    },
    { href: '/schedule', label: 'Scheduled', icon: <IconClock />, requires: 'editorial' },
    { href: '/media', label: 'Media library', icon: <IconImage /> },
    { href: '/assignments', label: 'Assignments', icon: <IconClipboard /> },
    { href: '/people', label: 'People', icon: <IconUsers />, requires: 'admin' },
    { href: '/settings', label: 'Settings', icon: <IconCog />, requires: 'admin' },
  ];

  const visible = items.filter((item) => {
    if (item.requires === 'admin') return session.isAdmin;
    if (item.requires === 'editorial') return session.isEditorial;
    return true;
  });

  const displayName = session.profile.display_name || session.profile.full_name;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper-raised px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="-ml-1 rounded-sm p-2 hover:bg-paper-sunk"
          aria-label="Open newsroom menu"
          aria-expanded={drawerOpen}
        >
          <IconMenu />
        </button>

        <span className="flex items-baseline gap-1">
          <span className="text-lg font-black tracking-tight text-brand">BCM10</span>
          <span className="text-sm font-semibold text-ink">Newsroom</span>
        </span>

        <Link
          href="/articles/new"
          className="rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          New
        </Link>
      </div>

      <Sidebar
        items={visible}
        counts={counts}
        pathname={pathname}
        session={session}
        displayName={displayName}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="min-w-0 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

function Sidebar({
  items,
  counts,
  pathname,
  session,
  displayName,
  drawerOpen,
  onClose,
}: {
  items: NavItem[];
  counts: { reviewQueue: number; changesRequested: number };
  pathname: string;
  session: Pick<NewsroomSession, 'profile' | 'isEditorial' | 'isAdmin'>;
  displayName: string;
  drawerOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-rule bg-paper-raised transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Newsroom navigation"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-4">
          <Link href="/" className="flex items-baseline gap-1">
            <span className="text-xl font-black tracking-tight text-brand">BCM10</span>
            <span className="text-sm font-semibold text-ink">Newsroom</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 hover:bg-paper-sunk lg:hidden"
            aria-label="Close menu"
          >
            <IconClose />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {items.map((item) => {
              // Exact match for the dashboard; prefix match elsewhere, so
              // /articles/123/edit still highlights "Stories".
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-light text-brand'
                        : 'text-ink-muted hover:bg-paper-sunk hover:text-ink'
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 ? (
                      <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-rule p-3">
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <p className="truncate text-xs text-ink-faint">{session.profile.email}</p>
            <p className="mt-1 inline-block rounded-xs bg-paper-sunk px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ink-muted uppercase">
              {session.profile.role.replace(/_/g, ' ')}
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href={ADMIN.publicSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-sm border border-rule px-2 py-1.5 text-center text-xs font-medium text-ink-muted hover:bg-paper-sunk"
            >
              View site
            </a>
            {/* POST, so a stray link cannot sign a reporter out mid-story. */}
            <form action="/auth/sign-out" method="post" className="flex-1">
              <button
                type="submit"
                className="w-full rounded-sm border border-rule px-2 py-1.5 text-xs font-medium text-ink-muted hover:bg-paper-sunk"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

/* Inline icons rather than an icon package: nine glyphs do not justify a
   dependency, and these ship as markup with no runtime cost. */
const iconProps = {
  className: 'size-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

function IconHome() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function IconDocument() {
  return (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg {...iconProps}>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M5 5h14l2 8v6H3v-6Z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5-4 4-2-2-7 7" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg {...iconProps}>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M18 20a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  );
}
function IconCog() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg {...iconProps} className="size-6">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg {...iconProps} className="size-5">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
