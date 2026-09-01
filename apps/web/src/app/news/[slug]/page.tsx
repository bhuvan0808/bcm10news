import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getArticleBySlug, type ArticleResult } from '@bcm10/database';
import { createClient } from '@bcm10/database/server';
import { contentDoc, truncateDoc, type ContentDoc } from '@bcm10/validation';
import { articleContext } from '@bcm10/analytics';
import { Badge } from '@bcm10/ui';
import { ArticleBody } from '@/components/article-body';
import { ArticleCard, CategoryLink } from '@/components/article-card';
import { MediaImage } from '@/components/media-image';
import { YouTubeEmbed } from '@/components/youtube-embed';
import { Paywall } from '@/components/paywall';
import { ShareBar } from '@/components/share-bar';
import { JsonLd } from '@/components/json-ld';
import { Comments } from '@/components/comments';
import { ArticleReadTracking } from './read-tracking';
import { cachedArticle, cachedMostRead, cachedRelated } from '@/lib/data';
import {
  articleMetadata,
  breadcrumbSchema,
  breadcrumbsForArticle,
  newsArticleSchema,
} from '@/lib/seo';
import { SITE, absoluteUrl, articlePath, authorPath, categoryPath } from '@/lib/site';
import { formatDateTime, localised, readingTimeLabel } from '@/lib/format';

/**
 * Article page.
 *
 * The access decision is the interesting part, and it is deliberately made by
 * Postgres rather than here:
 *
 *  1. The cached, anonymous read gives us what a signed-out reader may see.
 *     For a free story that is the whole thing, and the page is fully static.
 *  2. If that read came back `paywalled`, the story is premium and the
 *     anonymous visitor is not entitled to it. Only then do we re-read with
 *     the reader's own session — one uncached query, on the small fraction of
 *     requests that need it.
 *  3. If RLS returns the row on that second read, the reader has the
 *     entitlement. If it does not, they see the teaser.
 *
 * At no point does this component hold a body it then decides to hide. There
 * is no `if (!subscribed) return teaser` over a full string in memory, which
 * is the version of this that leaks through view-source.
 */

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await cachedArticle(decodeURIComponent(slug));

  if (!result.preview) return { title: 'Story not found' };
  return articleMetadata(result.preview, result.author);
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const anonymous = await cachedArticle(slug);

  // A retired slug still resolves — old links and shares must not 404.
  if (anonymous.redirectToSlug) permanentRedirect(articlePath(anonymous.redirectToSlug));
  if (!anonymous.preview) notFound();

  const result = await resolveAccess(slug, anonymous);
  const { preview } = result;
  if (!preview) notFound();

  const hasFullAccess = result.access === 'full' && result.article !== null;
  const body = parseBody(result.article?.body);
  const locale = preview.language;

  const [related, mostRead] = await Promise.all([
    cachedRelated(preview.id, preview.category_slug, 6).catch(() => []),
    cachedMostRead(6).catch(() => []),
  ]);

  const url = absoluteUrl(articlePath(preview.slug));
  const trackingContext = articleContext({
    id: preview.id,
    slug: preview.slug,
    category_slug: preview.category_slug,
    author_id: preview.author_id,
    is_premium: preview.is_premium,
    is_breaking: preview.is_breaking,
    reading_time_minutes: preview.reading_time_minutes,
    language: preview.language,
  });

  return (
    <>
      <JsonLd
        data={[
          newsArticleSchema({
            article: preview,
            author: result.author,
            isAccessibleForFree: !preview.is_premium,
          }),
          breadcrumbSchema(breadcrumbsForArticle(preview)),
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-12">
        <article className="lg:col-span-8">
          <Breadcrumbs preview={preview} locale={locale} />

          <header className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryLink
                slug={preview.category_slug}
                name={localised(preview.category_name, preview.category_name_te, locale)}
              />
              {preview.is_breaking ? <Badge tone="brand">Breaking</Badge> : null}
              {preview.is_exclusive ? <Badge tone="neutral">Exclusive</Badge> : null}
              {preview.is_premium ? <Badge tone="premium">Premium</Badge> : null}
              {preview.is_sponsored ? <Badge tone="muted">Sponsored</Badge> : null}
            </div>

            <h1 className="mt-2 text-3xl leading-[1.15] font-black tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
              {localised(preview.title, preview.title_te, locale)}
            </h1>

            {preview.subtitle ? (
              <p className="mt-3 font-serif text-lg leading-relaxed text-ink-muted sm:text-xl">
                {preview.subtitle}
              </p>
            ) : null}

            <Byline
              preview={preview}
              author={result.author}
              coauthors={result.coauthors}
              locale={locale}
            />
          </header>

          {preview.featured_image_key ? (
            <figure className="mt-6">
              <MediaImage
                storageKey={preview.featured_image_key}
                alt={localised(preview.featured_image_alt, preview.featured_image_alt_te, locale)}
                width={preview.featured_image_width ?? 1600}
                height={preview.featured_image_height ?? 900}
                variants={preview.featured_image_variants}
                blurDataUrl={preview.featured_image_blur}
                sizeName="hero"
                // The lead image is the LCP element on this page.
                priority
                className="w-full rounded-sm"
              />
              {preview.featured_image_caption || preview.featured_image_credit ? (
                <figcaption className="mt-2 text-sm text-ink-muted">
                  {preview.featured_image_caption}
                  {preview.featured_image_credit ? (
                    <span className="ml-2 text-ink-faint">({preview.featured_image_credit})</span>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          <ShareBar url={url} title={preview.title} context={trackingContext} className="mt-6" />

          <ArticleReadTracking articleId={preview.id} context={trackingContext}>
            {hasFullAccess ? (
              <ArticleBody doc={body} lang={locale} />
            ) : (
              <>
                {/* The teaser is built from what RLS already gave us — the
                    excerpt and subtitle — not from a truncated full body. */}
                <div className="prose-article" lang={locale}>
                  {preview.excerpt ? <p>{preview.excerpt}</p> : null}
                </div>
                <Paywall
                  title={preview.title}
                  isSignedIn={result.signedIn}
                  returnTo={articlePath(preview.slug)}
                />
              </>
            )}
          </ArticleReadTracking>

          {hasFullAccess && result.article?.videos?.length ? (
            <section aria-label="Videos" className="mt-8 space-y-6">
              {result.article.videos
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((video) => (
                  <div key={video.id}>
                    <YouTubeEmbed
                      videoId={video.video_id}
                      title={video.title ?? preview.title}
                      isShort={video.is_short}
                    />
                    {video.caption ? (
                      <p className="mt-2 text-sm text-ink-muted">{video.caption}</p>
                    ) : null}
                  </div>
                ))}
            </section>
          ) : null}

          {result.tags.length ? (
            <nav
              aria-label="Topics"
              className="mt-8 flex flex-wrap gap-2 border-t border-rule pt-6"
            >
              {result.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${encodeURIComponent(tag.slug)}`}
                  className="rounded-sm bg-paper-sunk px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-rule hover:text-ink"
                >
                  #{localised(tag.name, tag.name_te, locale)}
                </Link>
              ))}
            </nav>
          ) : null}

          <ShareBar url={url} title={preview.title} context={trackingContext} className="mt-6" />

          {/* Comments render only when the site setting and the story flag are
              both on; the component decides, so the page stays uncluttered. */}
          <Comments
            articleId={preview.id}
            articleSlug={preview.slug}
            allowComments={result.article?.allow_comments ?? false}
          />

          {related.length ? (
            <section aria-labelledby="related-heading" className="mt-12">
              <h2
                id="related-heading"
                className="mb-4 border-b-2 border-ink pb-2 text-xl font-black tracking-tight"
              >
                Read next
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="standard"
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            {mostRead.length ? (
              <section aria-labelledby="most-read-heading">
                <h2
                  id="most-read-heading"
                  className="mb-2 border-b-2 border-ink pb-2 text-lg font-black tracking-tight"
                >
                  Most read
                </h2>
                <ol>
                  {mostRead.map((article, index) => (
                    <li key={article.id}>
                      <ArticleCard
                        article={article}
                        variant="compact"
                        rank={index + 1}
                        locale={locale}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}

/**
 * Decides what this particular reader may see.
 *
 * Free stories short-circuit on the cached anonymous read, so the common case
 * costs nothing. Only a premium story triggers the session-scoped query, and
 * that query is the authorization check — we do not ask "is this user a
 * subscriber", we ask Postgres for the row and see whether it comes back.
 */
async function resolveAccess(
  slug: string,
  anonymous: ArticleResult
): Promise<ArticleResult & { signedIn: boolean }> {
  if (anonymous.access === 'full') {
    return { ...anonymous, signedIn: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ...anonymous, signedIn: false };

  const authorised = await getArticleBySlug(supabase, slug);
  return { ...authorised, signedIn: true };
}

/** Validates the stored tree before rendering. A malformed doc renders empty. */
function parseBody(raw: unknown): ContentDoc {
  const parsed = contentDoc.safeParse(raw);
  return parsed.success ? parsed.data : { type: 'doc', content: [] };
}

function Breadcrumbs({
  preview,
  locale,
}: {
  preview: NonNullable<ArticleResult['preview']>;
  locale: 'te' | 'en';
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-xs text-ink-faint">
        <li>
          <Link href="/" className="hover:text-brand">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href={categoryPath(preview.category_slug)} className="hover:text-brand">
            {localised(preview.category_name, preview.category_name_te, locale)}
          </Link>
        </li>
      </ol>
    </nav>
  );
}

function Byline({
  preview,
  author,
  coauthors,
  locale,
}: {
  preview: NonNullable<ArticleResult['preview']>;
  author: ArticleResult['author'];
  coauthors: ArticleResult['coauthors'];
  locale: 'te' | 'en';
}) {
  const names = [author, ...coauthors].filter(Boolean);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule py-3 text-sm">
      {preview.byline_override ? (
        <span className="font-semibold text-ink">{preview.byline_override}</span>
      ) : names.length ? (
        <span className="font-semibold text-ink">
          {names.map((person, index) => (
            <span key={person!.id}>
              {index > 0 ? ', ' : ''}
              {person!.slug ? (
                <Link href={authorPath(person!.slug)} className="hover:text-brand hover:underline">
                  {person!.name}
                </Link>
              ) : (
                person!.name
              )}
            </span>
          ))}
        </span>
      ) : (
        <span className="font-semibold text-ink">{SITE.name}</span>
      )}

      {preview.location_name ? (
        <span className="text-ink-muted">
          · {localised(preview.location_name, preview.location_name_te, locale)}
        </span>
      ) : null}

      <span className="text-ink-faint">
        ·{' '}
        <time dateTime={preview.published_at}>
          {formatDateTime(preview.published_at, locale)} IST
        </time>
      </span>

      <span className="text-ink-faint">
        · {readingTimeLabel(preview.reading_time_minutes, locale)}
      </span>
    </div>
  );
}
