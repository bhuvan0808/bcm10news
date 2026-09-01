import type { Metadata } from 'next';
import type { ArticlePreview, Author } from '@bcm10/database';
import { imageUrl, parseVariants } from '@bcm10/storage';
import { SITE, absoluteUrl, articlePath, authorPath, categoryPath } from './site';
import { toIsoString } from './format';

/**
 * SEO.
 *
 * A news site that depends on social traffic alone is one algorithm change
 * from irrelevance, so search and Google News are treated as first-class
 * output: every article emits a canonical URL, OpenGraph and Twitter cards,
 * and NewsArticle + BreadcrumbList structured data.
 *
 * The canonical URL is always the site's own, derived from the slug, unless an
 * editor has explicitly set one — a syndicated piece should point at the
 * original, and that is an editorial decision, not an automatic one.
 */

const OG_FALLBACK = absoluteUrl('/og-default.png');

export function ogImageFor(preview: {
  featured_image_key?: string | null;
  featured_image_variants?: unknown;
  featured_image_alt?: string | null;
  featured_image_width?: number | null;
  featured_image_height?: number | null;
}): { url: string; width: number; height: number; alt?: string } {
  if (!preview.featured_image_key) {
    return { url: OG_FALLBACK, width: 1200, height: 630 };
  }

  return {
    url: imageUrl(
      {
        baseUrl: SITE.mediaBaseUrl,
        storageKey: preview.featured_image_key,
        variants: parseVariants(preview.featured_image_variants),
        cloudflareResizing: SITE.cloudflareResizing,
      },
      1200
    ),
    width: preview.featured_image_width ?? 1200,
    height: preview.featured_image_height ?? 630,
    alt: preview.featured_image_alt ?? undefined,
  };
}

export function articleMetadata(article: ArticlePreview, author: Author | null): Metadata {
  const title = article.seo_title?.trim() || article.title;
  const description =
    article.seo_description?.trim() ||
    article.excerpt?.trim() ||
    article.subtitle?.trim() ||
    `${article.title} — ${SITE.name}`;

  const url = article.canonical_url?.trim() || absoluteUrl(articlePath(article.slug));
  const image = ogImageFor(article);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: article.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.ogLocale,
      publishedTime: toIsoString(article.published_at),
      modifiedTime: toIsoString(article.updated_at),
      authors: author?.name ? [author.name] : undefined,
      section: article.category_name,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE.twitter,
      title,
      description,
      images: [image.url],
    },
    other: {
      // Consumed by Google News and several Indian aggregators.
      'article:published_time': toIsoString(article.published_at),
      'article:section': article.category_name,
    },
  };
}

export function listMetadata(options: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(options.path);

  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: url },
    robots: options.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      title: options.title,
      description: options.description,
      url,
      siteName: SITE.name,
      locale: SITE.ogLocale,
      images: [{ url: OG_FALLBACK, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE.twitter,
      title: options.title,
      description: options.description,
    },
  };
}

// -----------------------------------------------------------------------------
// Structured data
// -----------------------------------------------------------------------------

/** The publisher block, referenced by every other node. */
export function organizationSchema() {
  return {
    '@type': 'NewsMediaOrganization',
    '@id': `${SITE.origin}/#organization`,
    name: SITE.name,
    url: SITE.origin,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/logo.png'),
      width: 600,
      height: 60,
    },
  };
}

export function newsArticleSchema(options: {
  article: ArticlePreview;
  author: Author | null;
  /** Present only when the reader can actually see the whole story. */
  bodyText?: string;
  isAccessibleForFree: boolean;
}) {
  const { article, author, isAccessibleForFree } = options;
  const url = absoluteUrl(articlePath(article.slug));
  const image = ogImageFor(article);

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.title.slice(0, 110),
    alternativeHeadline: article.title_te ?? undefined,
    description: article.excerpt ?? article.subtitle ?? undefined,
    articleSection: article.category_name,
    inLanguage: article.language === 'te' ? 'te-IN' : 'en-IN',
    datePublished: toIsoString(article.published_at),
    dateModified: toIsoString(article.updated_at),
    wordCount: article.word_count || undefined,
    image: [image.url],
    author: author
      ? {
          '@type': 'Person',
          name: author.name,
          url: author.slug ? absoluteUrl(authorPath(author.slug)) : undefined,
        }
      : { '@type': 'Organization', name: SITE.name },
    publisher: organizationSchema(),

    /*
     * Google's paywalled-content markup. Declaring the paywall honestly lets
     * the crawler index the full story without treating the teaser as
     * cloaking. `cssSelector` must match the element the renderer wraps the
     * gated body in.
     */
    isAccessibleForFree,
    ...(article.is_premium && !isAccessibleForFree
      ? {
          hasPart: {
            '@type': 'WebPageElement',
            isAccessibleForFree: false,
            cssSelector: '.paywalled-content',
          },
        }
      : {}),
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.origin}/#website`,
    url: SITE.origin,
    name: SITE.name,
    publisher: organizationSchema(),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.origin}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function collectionSchema(options: {
  name: string;
  path: string;
  items: ArticlePreview[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: options.name,
    url: absoluteUrl(options.path),
    publisher: organizationSchema(),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: options.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(articlePath(item.slug)),
        name: item.title,
      })),
    },
  };
}

export function breadcrumbsForArticle(article: ArticlePreview) {
  return [
    { name: 'Home', path: '/' },
    { name: article.category_name, path: categoryPath(article.category_slug) },
    { name: article.title, path: articlePath(article.slug) },
  ];
}
