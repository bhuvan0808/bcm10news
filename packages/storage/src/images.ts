import { IMAGE_VARIANTS, type MediaVariant } from '@bcm10/validation';

/**
 * Image delivery.
 *
 * A reader on a district 3G connection must never download a 6 MB camera file
 * to see a 400px card. Two mechanisms, in order of preference:
 *
 *  1. Pre-generated variants recorded on the media row. Cheapest to serve —
 *     a plain CDN hit, no transform.
 *  2. Cloudflare Image Resizing (`/cdn-cgi/image/...`) in front of R2, which
 *     produces a width on demand and caches it at the edge.
 *
 * When neither is available the original is served and `next/image` optimises
 * it. That is the correct fallback, not the target.
 */

export interface ImageSourceOptions {
  /** Public base URL of the media domain, e.g. https://images.bcm10news.in */
  baseUrl: string;
  storageKey: string;
  variants?: MediaVariant[] | null;
  /** Cloudflare Image Resizing is a paid feature; off unless explicitly enabled. */
  cloudflareResizing?: boolean;
}

const WIDTHS = IMAGE_VARIANTS.map((variant) => variant.width);

function join(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

/** URL for a specific width. */
export function imageUrl(options: ImageSourceOptions, width?: number): string {
  const { baseUrl, storageKey, variants, cloudflareResizing } = options;

  if (width && variants?.length) {
    // Smallest variant that still covers the requested width, so we never
    // upscale a derivative.
    const match = [...variants]
      .sort((a, b) => a.width - b.width)
      .find((variant) => variant.width >= width);
    if (match) return join(baseUrl, match.key);
  }

  if (width && cloudflareResizing) {
    const params = `width=${width},quality=80,format=auto,fit=scale-down`;
    return `${baseUrl.replace(/\/+$/, '')}/cdn-cgi/image/${params}/${storageKey.replace(/^\/+/, '')}`;
  }

  return join(baseUrl, storageKey);
}

/**
 * srcset covering the standard widths, capped at the image's intrinsic width
 * so the browser is never offered an upscale.
 */
export function buildSrcSet(
  options: ImageSourceOptions & { intrinsicWidth?: number | null }
): string {
  const max = options.intrinsicWidth ?? Number.POSITIVE_INFINITY;
  const widths = WIDTHS.filter((width) => width <= max);

  if (!widths.length) return imageUrl(options);

  return widths.map((width) => `${imageUrl(options, width)} ${width}w`).join(', ');
}

/**
 * `sizes` for the common layouts. Getting this wrong is the usual cause of a
 * phone downloading a desktop-sized image, so the values are named rather than
 * written inline at each call site.
 */
export const IMAGE_SIZES = {
  /** Full-bleed lead image. */
  hero: '(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1200px',
  /** Card in a 2–3 column grid. */
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px',
  /** Small thumbnail in a list. */
  thumb: '(max-width: 640px) 33vw, 160px',
  /** Inline figure inside article prose. */
  figure: '(max-width: 768px) 100vw, 720px',
  avatar: '48px',
} as const;

export type ImageSizeName = keyof typeof IMAGE_SIZES;

/** Parses the media row's `variants` jsonb into a typed array, tolerating junk. */
export function parseVariants(raw: unknown): MediaVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is MediaVariant =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as MediaVariant).key === 'string' &&
      typeof (entry as MediaVariant).width === 'number'
  );
}
