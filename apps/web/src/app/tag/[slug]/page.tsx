import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@/components/article-card';
import { Pagination } from '@/components/pagination';
import { cachedTag, cachedTagArticles } from '@/lib/data';
import { listMetadata } from '@/lib/seo';
import { tagPath } from '@/lib/site';
import { localised } from '@/lib/format';

const PER_PAGE = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await cachedTag(decodeURIComponent(slug));
  if (!tag) return { title: 'Topic not found' };

  return listMetadata({
    title: `${tag.name} — news and updates`,
    description: tag.description || `Every BCM10 News story tagged ${tag.name}.`,
    path: tagPath(slug),
  });
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params;
  const { page: rawPage } = await searchParams;
  const slug = decodeURIComponent(rawSlug);

  const tag = await cachedTag(slug);
  if (!tag) notFound();

  const page = Math.max(1, Number(rawPage ?? '1') || 1);
  const { items, total } = await cachedTagArticles(slug, page, PER_PAGE);

  return (
    <>
      <header className="border-b-2 border-ink pb-3">
        <p className="kicker">Topic</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          #{localised(tag.name, tag.name_te, 'te')}
        </h1>
        {tag.description ? (
          <p className="mt-2 max-w-2xl text-ink-muted">{tag.description}</p>
        ) : null}
      </header>

      {items.length ? (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((article) => (
              <ArticleCard key={article.id} article={article} variant="standard" />
            ))}
          </div>

          <Pagination
            page={page}
            perPage={PER_PAGE}
            total={total}
            basePath={tagPath(slug)}
            className="mt-10"
          />
        </>
      ) : (
        <p className="py-16 text-center text-ink-muted">No stories carry this topic yet.</p>
      )}
    </>
  );
}
