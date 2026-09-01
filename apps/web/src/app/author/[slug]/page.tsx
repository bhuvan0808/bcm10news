import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { imageUrl } from '@bcm10/storage';
import { ArticleCard } from '@/components/article-card';
import { Pagination } from '@/components/pagination';
import { JsonLd } from '@/components/json-ld';
import { cachedAuthor, cachedAuthorArticles } from '@/lib/data';
import { listMetadata, organizationSchema } from '@/lib/seo';
import { SITE, absoluteUrl, authorPath } from '@/lib/site';

/**
 * Reporter page.
 *
 * Bylines link here, which matters for a newsroom in two ways: readers follow
 * reporters, and a Person schema with a stable URL is one of the signals
 * Google uses to assess who is behind a story.
 *
 * The data comes from the `author_profiles` view, not the `profiles` table —
 * profiles holds email and phone and is not readable by anonymous visitors.
 */

const PER_PAGE = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = await cachedAuthor(slug);
  if (!author) return { title: 'Reporter not found' };

  return listMetadata({
    title: author.name,
    description: author.bio || `Stories filed by ${author.name} for ${SITE.name}.`,
    path: authorPath(slug),
  });
}

export default async function AuthorPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;

  const author = await cachedAuthor(slug);
  if (!author) notFound();

  const page = Math.max(1, Number(rawPage ?? '1') || 1);
  const { items, total } = await cachedAuthorArticles(author.id, page, PER_PAGE);

  const avatar = author.avatar_key
    ? imageUrl({ baseUrl: SITE.mediaBaseUrl, storageKey: author.avatar_key }, 160)
    : null;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: author.name,
            description: author.bio ?? undefined,
            jobTitle: author.designation ?? undefined,
            url: absoluteUrl(authorPath(slug)),
            image: avatar ?? undefined,
            worksFor: organizationSchema(),
          },
        }}
      />

      <header className="flex flex-col gap-4 border-b-2 border-ink pb-6 sm:flex-row sm:items-start">
        {avatar ? (
          // Plain <img>: one small avatar, already sized by the variant URL.
          <img
            src={avatar}
            alt=""
            width={80}
            height={80}
            className="size-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex size-20 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-2xl font-black text-ink-faint"
            aria-hidden="true"
          >
            {author.name.charAt(0)}
          </div>
        )}

        <div>
          <p className="kicker">Reporter</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">{author.name}</h1>
          {author.designation ? (
            <p className="mt-0.5 text-sm font-medium text-ink-muted">{author.designation}</p>
          ) : null}
          {author.bio ? <p className="mt-3 max-w-2xl text-ink-muted">{author.bio}</p> : null}
          <p className="mt-2 text-sm text-ink-faint">
            {author.article_count.toLocaleString('en-IN')} published{' '}
            {author.article_count === 1 ? 'story' : 'stories'}
          </p>
        </div>
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
            basePath={authorPath(slug)}
            className="mt-10"
          />
        </>
      ) : (
        <p className="py-16 text-center text-ink-muted">No published stories yet.</p>
      )}
    </>
  );
}
