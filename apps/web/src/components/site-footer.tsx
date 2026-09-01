import Link from 'next/link';
import type { NavCategory } from '@bcm10/database';
import { NewsletterForm } from './newsletter-form';
import { SITE, categoryPath } from '@/lib/site';
import { localised } from '@/lib/format';

const LEGAL_LINKS = [
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/subscribe', label: 'Subscribe' },
];

export function SiteFooter({
  navigation,
  locale = 'te',
  contactEmail,
}: {
  navigation: NavCategory[];
  locale?: 'te' | 'en';
  contactEmail?: string | null;
}) {
  return (
    <footer className="mt-16 border-t-[3px] border-brand bg-paper-sunk">
      <div className="mx-auto max-w-(--container-page) px-4 py-10">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-brand">BCM10</span>
              <span className="text-lg font-semibold tracking-tight text-ink">News</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
              Reporting from Andhra Pradesh and Telangana — politics, business, sport and cinema, in
              Telugu and English.
            </p>

            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="mt-3 inline-block text-sm text-ink-muted hover:text-brand"
              >
                {contactEmail}
              </a>
            ) : null}
          </div>

          <nav aria-label="Sections" className="md:col-span-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">Sections</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {navigation.slice(0, 12).map((category) => (
                <li key={category.id}>
                  <Link href={categoryPath(category.slug)} className="text-ink-muted hover:text-brand">
                    {localised(category.name, category.name_te, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
              Daily briefing
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              The stories that matter, in your inbox each morning.
            </p>
            <NewsletterForm source="footer" className="mt-3" />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-rule pt-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>

          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/rss.xml" className="hover:text-brand">
                  RSS
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
