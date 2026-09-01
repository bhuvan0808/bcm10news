import Image from 'next/image';
import { IMAGE_SIZES, imageUrl, parseVariants, type ImageSizeName } from '@bcm10/storage';
import { SITE } from '@/lib/site';

/**
 * Image rendering for stored media.
 *
 * Wraps next/image so every call site gets the same three things right:
 *
 *  • a `sizes` value from the named layout table, because getting `sizes`
 *    wrong is the usual reason a phone downloads a desktop-sized file
 *  • the blur placeholder recorded at upload, so cards do not flash grey
 *  • `priority` only where it is genuinely the LCP element — marking several
 *    images priority makes all of them slower, not faster
 */
export function MediaImage({
  storageKey,
  alt,
  width,
  height,
  variants,
  blurDataUrl,
  sizeName = 'card',
  priority = false,
  className,
  quality = 78,
}: {
  storageKey: string;
  alt: string;
  width: number;
  height: number;
  variants?: unknown;
  blurDataUrl?: string | null;
  sizeName?: ImageSizeName;
  priority?: boolean;
  className?: string;
  quality?: number;
}) {
  const src = imageUrl({
    baseUrl: SITE.mediaBaseUrl,
    storageKey,
    variants: parseVariants(variants),
    cloudflareResizing: SITE.cloudflareResizing,
  });

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={IMAGE_SIZES[sizeName]}
      quality={quality}
      priority={priority}
      // Below-the-fold images stay lazy; the LCP image opts out via `priority`.
      loading={priority ? undefined : 'lazy'}
      placeholder={blurDataUrl ? 'blur' : 'empty'}
      blurDataURL={blurDataUrl ?? undefined}
      className={className}
    />
  );
}

/**
 * Placeholder for a story filed without a picture — a common case on a
 * fast-moving desk. A tinted block with the masthead mark reads better in a
 * grid than a collapsed empty box.
 */
export function ImageFallback({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-paper-sunk text-rule-strong ${className ?? ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-5-5-4 4-2-2-7 7" />
      </svg>
    </div>
  );
}
