/**
 * Site-level constants.
 *
 * Kept out of components so the canonical origin has exactly one definition —
 * a mismatch between the canonical tag, the sitemap and the OG URL is the
 * classic way a news site splits its own ranking signals.
 */

function readOrigin(): string {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured) return configured.replace(/\/+$/, '');

  // Preview deployments have no configured origin; Vercel supplies the host.
  const vercel = process.env['VERCEL_URL'];
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export const SITE = {
  origin: readOrigin(),
  name: process.env['NEXT_PUBLIC_SITE_NAME'] ?? 'BCM10 News',
  shortName: 'BCM10',
  defaultLocale: (process.env['NEXT_PUBLIC_DEFAULT_LOCALE'] ?? 'te') as 'te' | 'en',
  /** Publisher locale for OG tags. Telugu as spoken in India. */
  ogLocale: 'te_IN',
  twitter: '@bcm10news',
  mediaBaseUrl:
    process.env['NEXT_PUBLIC_MEDIA_URL']?.replace(/\/+$/, '') ?? 'https://images.bcm10news.in',
  /** Cloudflare Image Resizing is a paid add-on; off until it is enabled. */
  cloudflareResizing: process.env['NEXT_PUBLIC_CF_IMAGE_RESIZING'] === 'true',
} as const;

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SITE.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function articlePath(slug: string): string {
  return `/news/${slug}`;
}

export function categoryPath(slug: string): string {
  return `/${slug}`;
}

export function authorPath(slug: string): string {
  return `/author/${slug}`;
}

export function tagPath(slug: string): string {
  return `/tag/${encodeURIComponent(slug)}`;
}
