import Link from 'next/link';
import type { ArticlePreview } from '@bcm10/database';
import { Badge, cn } from '@bcm10/ui';
import { MediaImage, ImageFallback } from './media-image';
import { articlePath, categoryPath } from '@/lib/site';
import { formatRelative, localised, readingTimeLabel } from '@/lib/format';

/**
 * Article cards.
 *
 * One component, five densities, because a news homepage is mostly the same
 * card at different weights and keeping them together is what stops the grid
 * drifting out of alignment as sections are added.
 *
 * The whole card is a single anchor rather than several: nested links make
 * keyboard navigation tedious (tab, tab, tab through one story) and confuse
 * screen readers about where they are.
 */

export type CardVariant = 'hero' | 'lead' | 'standard' | 'list' | 'compact';

interface ArticleCardProps {
  article: ArticlePreview;
  variant?: CardVariant;
  /** Set on the single LCP image — the top-left story on the homepage. */
  priority?: boolean;
  showCategory?: boolean;
  showExcerpt?: boolean;
  locale?: 'te' | 'en';
  className?: string;
  /** Rank number, for the "most read" list. */
  rank?: number;
}

export function ArticleCard({
  article,
  variant = 'standard',
  priority = false,
  showCategory = true,
  showExcerpt,
  locale = 'te',
  className,
  rank,
}: ArticleCardProps) {
  const title = localised(article.title, article.title_te, locale);
  const href = articlePath(article.slug);

  if (variant === 'compact') {
    return (
      <CompactCard article={article} title={title} href={href} rank={rank} locale={locale} className={className} />
    );
  }

  if (variant === 'list') {
    return (
      <ListCard
        article={article}
        title={title}
        href={href}
        locale={locale}
        showCategory={showCategory}
        className={className}
      />
    );
  }

  const isHero = variant === 'hero';
  const isLead = variant === 'lead';
  const withExcerpt = showExcerpt ?? (isHero || isLead);

  return (
    <article className={cn('group', className)}>
      <Link href={href} className="block focus-visible:outline-offset-4">
        <div
          className={cn(
            'relative overflow-hidden rounded-sm bg-paper-sunk',
            isHero ? 'aspect-16/9' : 'aspect-3/2'
          )}
        >
          {article.featured_image_key ? (
            <MediaImage
              storageKey={article.featured_image_key}
              alt={localised(article.featured_image_alt, article.featured_image_alt_te, locale)}
              width={article.featured_image_width ?? 1200}
              height={article.featured_image_height ?? 800}
              variants={article.featured_image_variants}
              blurDataUrl={article.featured_image_blur}
              sizeName={isHero ? 'hero' : 'card'}
              priority={priority}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <ImageFallback className="size-full" />
          )}

          {(article.is_breaking || article.is_premium) && (
            <div className="absolute left-2 top-2 flex gap-1.5">
              {article.is_breaking ? <Badge tone="brand">Breaking</Badge> : null}
              {article.is_premium ? <Badge tone="premium">Premium</Badge> : null}
            </div>
          )}
        </div>

        <div className="mt-3">
          {showCategory ? <CategoryKicker article={article} locale={locale} /> : null}

          <h3
            className={cn(
              'mt-1 font-bold leading-snug text-ink transition-colors group-hover:text-brand',
              isHero
                ? 'clamp-3 text-2xl sm:text-3xl md:text-[2rem]'
                : isLead
                  ? 'clamp-3 text-xl'
                  : 'clamp-3 text-base sm:text-lg'
            )}
          >
            {title}
          </h3>

          {withExcerpt && article.excerpt ? (
            <p className={cn('mt-2 text-ink-muted', isHero ? 'clamp-3 text-base' : 'clamp-2 text-sm')}>
              {article.excerpt}
            </p>
          ) : null}

          <CardMeta article={article} locale={locale} className="mt-2" />
        </div>
      </Link>
    </article>
  );
}

function ListCard({
  article,
  title,
  href,
  locale,
  showCategory,
  className,
}: {
  article: ArticlePreview;
  title: string;
  href: string;
  locale: 'te' | 'en';
  showCategory: boolean;
  className?: string;
}) {
  return (
    <article className={cn('group border-b border-rule pb-4 last:border-0', className)}>
      <Link href={href} className="flex gap-3 focus-visible:outline-offset-4">
        <div className="min-w-0 flex-1">
          {showCategory ? <CategoryKicker article={article} locale={locale} /> : null}
          <h3 className="clamp-3 mt-1 font-bold leading-snug text-ink transition-colors group-hover:text-brand">
            {title}
          </h3>
          <CardMeta article={article} locale={locale} className="mt-1.5" />
        </div>

        <div className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-paper-sunk sm:size-24">
          {article.featured_image_key ? (
            <MediaImage
              storageKey={article.featured_image_key}
              alt=""
              width={200}
              height={200}
              variants={article.featured_image_variants}
              blurDataUrl={article.featured_image_blur}
              sizeName="thumb"
              className="size-full object-cover"
            />
          ) : (
            <ImageFallback className="size-full" />
          )}
        </div>
      </Link>
    </article>
  );
}

function CompactCard({
  article,
  title,
  href,
  rank,
  locale,
  className,
}: {
  article: ArticlePreview;
  title: string;
  href: string;
  rank?: number;
  locale: 'te' | 'en';
  className?: string;
}) {
  return (
    <article className={cn('group border-b border-rule py-3 last:border-0', className)}>
      <Link href={href} className="flex gap-3 focus-visible:outline-offset-4">
        {rank !== undefined ? (
          <span
            className="shrink-0 text-2xl font-black leading-none text-rule-strong tabular-nums"
            aria-hidden="true"
          >
            {rank}
          </span>
        ) : null}

        <div className="min-w-0">
          <h3 className="clamp-3 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
            {title}
          </h3>
          <time
            dateTime={article.published_at}
            className="mt-1 block text-xs text-ink-faint"
            suppressHydrationWarning
          >
            {formatRelative(article.published_at, locale)}
          </time>
        </div>
      </Link>
    </article>
  );
}

function CategoryKicker({ article, locale }: { article: ArticlePreview; locale: 'te' | 'en' }) {
  return (
    <span className="kicker">{localised(article.category_name, article.category_name_te, locale)}</span>
  );
}

/**
 * Byline and timestamp.
 *
 * `suppressHydrationWarning` on the relative time is deliberate: the server
 * renders "5 minutes ago" at build time and the client may compute a slightly
 * different value on hydration. That mismatch is expected and harmless, and
 * warning about it on every card would bury real hydration bugs.
 */
function CardMeta({
  article,
  locale,
  className,
}: {
  article: ArticlePreview;
  locale: 'te' | 'en';
  className?: string;
}) {
  const byline = article.byline_override || localised(article.author_name, article.author_name_te, locale);

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint', className)}>
      {byline ? <span className="font-medium text-ink-muted">{byline}</span> : null}
      <span aria-hidden="true">·</span>
      <time dateTime={article.published_at} suppressHydrationWarning>
        {formatRelative(article.published_at, locale)}
      </time>
      {article.reading_time_minutes > 1 ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{readingTimeLabel(article.reading_time_minutes, locale)}</span>
        </>
      ) : null}
    </div>
  );
}

/** Category link used above a headline where the kicker should navigate. */
export function CategoryLink({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  return (
    <Link href={categoryPath(slug)} className={cn('kicker hover:underline', className)}>
      {name}
    </Link>
  );
}
