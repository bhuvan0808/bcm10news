import Link from 'next/link';
import type { NavCategory } from '@bcm10/database';
import { MobileNav } from './mobile-nav';
import { SearchTrigger } from './search-trigger';
import { SITE, categoryPath } from '@/lib/site';
import { localised } from '@/lib/format';

/**
 * Masthead and primary navigation.
 *
 * A server component: the nav is the same for every reader and changes only
 * when an editor edits the category list, so it is cached with the
 * `navigation` tag and costs nothing per request. Only the two genuinely
 * interactive pieces — the mobile drawer and the search box — are client
 * components.
 */
export function SiteHeader({
  navigation,
  locale = 'te',
  dateLabel,
}: {
  navigation: NavCategory[];
  locale?: 'te' | 'en';
  dateLabel: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-brand bg-paper/95 backdrop-blur-sm">
      {/* Utility strip: dateline and account, de-emphasised. */}
      <div className="hidden border-b border-rule md:block">
        <div className="mx-auto flex max-w-(--container-page) items-center justify-between px-4 py-1.5 text-xs text-ink-faint">
          <span>{dateLabel}</span>
          <nav aria-label="Utility" className="flex items-center gap-4">
            <Link href="/videos" className="hover:text-brand">
              Videos
            </Link>
            <Link href="/photos" className="hover:text-brand">
              Photos
            </Link>
            <Link href="/subscribe" className="font-semibold text-brand hover:underline">
              Subscribe
            </Link>
            <Link href="/account" className="hover:text-brand">
              Sign in
            </Link>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-(--container-page) px-4">
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <MobileNav navigation={navigation} locale={locale} />

            <Link href="/" className="flex items-baseline gap-1.5" aria-label={`${SITE.name} home`}>
              <span className="text-2xl font-black tracking-tight text-brand sm:text-3xl">
                BCM10
              </span>
              <span className="text-lg font-semibold tracking-tight text-ink sm:text-xl">News</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <SearchTrigger />
            <Link
              href="/subscribe"
              className="hidden rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:inline-block"
            >
              Subscribe
            </Link>
          </div>
        </div>

        {/* Section bar. Horizontally scrollable on narrow screens rather than
            wrapping to three rows and pushing the story below the fold. */}
        <nav
          aria-label="Sections"
          className="-mx-4 hidden [scrollbar-width:none] overflow-x-auto px-4 md:block [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex items-center gap-1 pb-2 text-sm font-semibold whitespace-nowrap">
            {navigation.map((category) => (
              <li key={category.id} className="group relative">
                <Link
                  href={categoryPath(category.slug)}
                  className="block rounded-sm px-3 py-1.5 text-ink transition-colors hover:bg-paper-sunk hover:text-brand"
                >
                  {localised(category.name, category.name_te, locale)}
                </Link>

                {category.children.length > 0 ? (
                  <ul className="invisible absolute top-full left-0 z-50 min-w-44 rounded-sm border border-rule bg-paper-raised py-1 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={categoryPath(child.slug)}
                          className="block px-3 py-1.5 text-sm font-normal text-ink hover:bg-paper-sunk hover:text-brand"
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
      </div>
    </header>
  );
}
