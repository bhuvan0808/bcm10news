import Link from 'next/link';
import type { ArticlePreview } from '@bcm10/database';
import { articlePath } from '@/lib/site';
import { localised } from '@/lib/format';

/**
 * Breaking-news ticker.
 *
 * Rendered server-side with a pure CSS marquee — no JavaScript, no layout
 * shift, and it works before hydration, which is the point of a breaking
 * strip.
 *
 * The headline list is duplicated so the translate(-50%) loop is seamless.
 * The copy is `aria-hidden` and the original carries the accessible text, so a
 * screen reader hears each headline once rather than twice. Animation pauses
 * on hover and on focus, so the link is actually clickable.
 */
export function BreakingTicker({
  articles,
  locale = 'te',
}: {
  articles: ArticlePreview[];
  locale?: 'te' | 'en';
}) {
  if (!articles.length) return null;

  const items = articles.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: localised(article.title, article.title_te, locale),
  }));

  return (
    <section aria-label="Breaking news" className="border-b border-rule bg-paper-raised">
      <div className="mx-auto flex max-w-(--container-page) items-stretch gap-3 px-4">
        <span className="flex shrink-0 items-center gap-2 bg-brand px-3 py-2 text-xs font-black uppercase tracking-wider text-white">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          Breaking
        </span>

        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-track flex w-max items-center gap-8 py-2">
            {items.map((item) => (
              <TickerItem key={item.id} slug={item.slug} title={item.title} />
            ))}
            {items.map((item) => (
              <TickerItem key={`${item.id}-repeat`} slug={item.slug} title={item.title} ariaHidden />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TickerItem({
  slug,
  title,
  ariaHidden = false,
}: {
  slug: string;
  title: string;
  ariaHidden?: boolean;
}) {
  return (
    <Link
      href={articlePath(slug)}
      aria-hidden={ariaHidden || undefined}
      tabIndex={ariaHidden ? -1 : undefined}
      className="whitespace-nowrap text-sm font-semibold text-ink hover:text-brand hover:underline"
    >
      {title}
    </Link>
  );
}
