import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@/components/article-card';
import { Pagination } from '@/components/pagination';
import { JsonLd } from '@/components/json-ld';
import { cachedCategory, cachedCategoryPage } from '@/lib/data';
import { collectionSchema, listMetadata } from '@/lib/seo';
import { categoryPath } from '@/lib/site';
import { localised } from '@/lib/format';

/**
 * Section page.
 *
 * Sits on the root dynamic segment, so /andhra-pradesh and /sports work
 * without a /category prefix — the URL shape a reader expects from a news
 * site. Next.js matches static segments (/news, /search, /subscribe) before
 * this one, so there is no collision; anything that is not a real category
 * falls through to notFound().
 */

const PER_PAGE = 24;

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const revalidate = 120;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await cachedCategory(slug);

  if (!category) return { title: 'Section not found' };

  return listMetadata({
    title: category.seo_title || `${category.name} news`,
    description:
      category.seo_description ||
      category.description ||
      `The latest ${category.name} coverage from BCM10 News.`,
    path: categoryPath(slug),
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const { page: rawPage } = await searchParams;

  const category = await cachedCategory(slug);
  if (!category) notFound();

  const page = Math.max(1, Number(rawPage ?? '1') || 1);
  const { items, total } = await cachedCategoryPage(slug, page, PER_PAGE);

  const [lead, ...rest] = items;
  const title = localised(category.name, category.name_te, 'te');

  return (
    <>
      <JsonLd data={collectionSchema({ name: title, path: categoryPath(slug), items })} />

      <header className="border-b-2 border-ink pb-3">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        {category.description ? (
          <p className="mt-2 max-w-2xl text-ink-muted">{category.description}</p>
        ) : null}
      </header>

      {!items.length ? (
        <p className="py-16 text-center text-ink-muted">
          No stories have been published in this section yet.
        </p>
      ) : (
        <>
          {/* Page one leads with a hero; later pages are a plain grid, because
              a "lead story" on page 4 of an archive is meaningless. */}
          {page === 1 && lead ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <ArticleCard article={lead} variant="hero" priority showExcerpt showCategory={false} />
              </div>
              <div className="lg:col-span-5">
                {rest.slice(0, 4).map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="list"
                    showCategory={false}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(page === 1 ? rest.slice(4) : items).map((article) => (
              <ArticleCard key={article.id} article={article} variant="standard" showCategory={false} />
            ))}
          </div>

          <Pagination
            page={page}
            perPage={PER_PAGE}
            total={total}
            basePath={categoryPath(slug)}
            className="mt-10"
          />
        </>
      )}
    </>
  );
}
