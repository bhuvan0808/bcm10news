import Link from 'next/link';
import type { HomepageSection } from '@bcm10/database';
import { ArticleCard } from './article-card';
import { categoryPath } from '@/lib/site';
import { localised } from '@/lib/format';

/**
 * Homepage section renderer.
 *
 * The layout comes from the database, so an editor can reorder the front page
 * or change a section from a grid to a carousel without a deploy. Each layout
 * is a fixed, tested arrangement rather than a free-form grid — that is what
 * keeps a dense homepage from turning ragged as sections are added.
 */
export function SectionBlock({
  section,
  locale = 'te',
  priority = false,
}: {
  section: HomepageSection;
  locale?: 'te' | 'en';
  priority?: boolean;
}) {
  if (!section.articles.length) return null;

  const title = localised(section.title, section.titleTe, locale);

  return (
    <section aria-labelledby={`section-${section.key}`} className="mt-10 first:mt-0">
      <SectionHeading id={`section-${section.key}`} title={title} href={section.categorySlug} />
      <SectionLayout section={section} locale={locale} priority={priority} />
    </section>
  );
}

function SectionHeading({ id, title, href }: { id: string; title: string; href: string | null }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
      <h2 id={id} className="text-xl font-black tracking-tight text-ink sm:text-2xl">
        {title}
      </h2>
      {href ? (
        <Link
          href={categoryPath(href)}
          className="shrink-0 text-sm font-semibold text-brand hover:underline"
        >
          More →
        </Link>
      ) : null}
    </div>
  );
}

function SectionLayout({
  section,
  locale,
  priority,
}: {
  section: HomepageSection;
  locale: 'te' | 'en';
  priority: boolean;
}) {
  const [first, ...rest] = section.articles;
  if (!first) return null;

  switch (section.layout) {
    /*
     * Hero: one dominant story with a stack of secondaries beside it. This is
     * the arrangement that tells a reader in one glance what the desk thinks
     * the day is about, so it gets the LCP image.
     */
    case 'hero':
      return (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ArticleCard article={first} variant="hero" priority={priority} locale={locale} showExcerpt />
          </div>

          <div className="lg:col-span-5">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {rest.slice(0, 2).map((article) => (
                <ArticleCard key={article.id} article={article} variant="lead" locale={locale} />
              ))}
            </div>

            {rest.length > 2 ? (
              <div className="mt-5 border-t border-rule pt-4">
                {rest.slice(2).map((article) => (
                  <ArticleCard key={article.id} article={article} variant="list" locale={locale} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      );

    case 'grid':
      return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {section.articles.map((article) => (
            <ArticleCard key={article.id} article={article} variant="standard" locale={locale} />
          ))}
        </div>
      );

    case 'list':
      return (
        <div className="grid gap-x-8 md:grid-cols-2">
          {section.articles.map((article) => (
            <ArticleCard key={article.id} article={article} variant="list" locale={locale} />
          ))}
        </div>
      );

    /*
     * Carousel: horizontal scroll with snap points. Native overflow rather
     * than a JS slider — it works without hydration, respects touch inertia,
     * and keeps the keyboard order linear.
     */
    case 'carousel':
      return (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          <div className="flex snap-x snap-mandatory gap-4">
            {section.articles.map((article) => (
              <div key={article.id} className="w-64 shrink-0 snap-start sm:w-72">
                <ArticleCard article={article} variant="standard" locale={locale} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'video':
      return (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <ArticleCard article={first} variant="hero" locale={locale} showExcerpt />
          </div>
          <div className="lg:col-span-4">
            {rest.map((article) => (
              <ArticleCard key={article.id} article={article} variant="list" locale={locale} />
            ))}
          </div>
        </div>
      );

    case 'gallery':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {section.articles.map((article) => (
            <ArticleCard key={article.id} article={article} variant="standard" locale={locale} showCategory={false} />
          ))}
        </div>
      );

    /* Compact: the numbered "most read" rail. */
    case 'compact':
      return (
        <ol className="grid gap-x-8 md:grid-cols-2">
          {section.articles.map((article, index) => (
            <li key={article.id}>
              <ArticleCard article={article} variant="compact" rank={index + 1} locale={locale} />
            </li>
          ))}
        </ol>
      );

    default:
      return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {section.articles.map((article) => (
            <ArticleCard key={article.id} article={article} variant="standard" locale={locale} />
          ))}
        </div>
      );
  }
}
