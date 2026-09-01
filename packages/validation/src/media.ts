import { z } from 'zod';
import { uuid } from './primitives';

/**
 * Media validation.
 *
 * The browser asks for a signed upload URL and uploads straight to storage, so
 * these limits are the last checkpoint before an object exists. They are
 * re-asserted by the `media_size_limit` CHECK in Postgres.
 */

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'] as const;

/** Per-kind ceilings, in bytes. A phone camera JPEG is comfortably under 25 MB. */
export const MAX_UPLOAD_BYTES = {
  image: 25 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
} as const;

export const mediaKind = z.enum(['image', 'document', 'audio', 'avatar']);
export type MediaKind = z.infer<typeof mediaKind>;

const MIME_BY_KIND: Record<MediaKind, readonly string[]> = {
  image: IMAGE_MIME_TYPES,
  avatar: IMAGE_MIME_TYPES,
  document: DOCUMENT_MIME_TYPES,
  audio: AUDIO_MIME_TYPES,
};

export const uploadRequestInput = z
  .object({
    kind: mediaKind.default('image'),
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      // Path separators and traversal sequences must never reach a storage key.
      .refine((name) => !/[\\/]|\.\./.test(name), 'File name must not contain a path'),
    mimeType: z.string().trim().min(3).max(100),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    const allowed = MIME_BY_KIND[value.kind];
    if (!allowed.includes(value.mimeType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mimeType'],
        message: `${value.mimeType} is not accepted for ${value.kind}. Allowed: ${allowed.join(', ')}`,
      });
    }

    const max = MAX_UPLOAD_BYTES[value.kind];
    if (value.sizeBytes > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sizeBytes'],
        message: `File is larger than the ${Math.round(max / 1024 / 1024)} MB limit for ${value.kind}`,
      });
    }
  });

export type UploadRequestInput = z.infer<typeof uploadRequestInput>;

/** Sent after the browser's PUT to storage succeeds. */
export const uploadConfirmInput = z.object({
  ticketId: uuid,
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  blurDataUrl: z.string().max(4000).optional(),
  dominantColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  altText: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(1000).optional(),
  credit: z.string().trim().max(200).optional(),
});

export type UploadConfirmInput = z.infer<typeof uploadConfirmInput>;

export const mediaUpdateInput = z.object({
  id: uuid,
  title: z.string().trim().max(200).optional(),
  altText: z.string().trim().max(500).optional(),
  altTextTe: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(1000).optional(),
  captionTe: z.string().trim().max(1000).optional(),
  credit: z.string().trim().max(200).optional(),
  copyright: z.string().trim().max(200).optional(),
  source: z.string().trim().max(200).optional(),
  photographerId: uuid.nullable().optional(),
  capturedAt: z.coerce.date().nullable().optional(),
});

export const mediaQueryInput = z.object({
  kind: mediaKind.optional(),
  search: z.string().trim().max(200).optional(),
  uploadedBy: uuid.optional(),
  photographerId: uuid.optional(),
  unusedOnly: z.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(40),
});

/**
 * Delivery widths. Generated once on upload and referenced by srcset so a
 * phone never downloads the original camera file.
 */
export const IMAGE_VARIANTS = [
  { label: 'thumbnail', width: 320 },
  { label: '480w', width: 480 },
  { label: '800w', width: 800 },
  { label: '1200w', width: 1200 },
  { label: '1600w', width: 1600 },
  { label: '2048w', width: 2048 },
] as const;

export type ImageVariantLabel = (typeof IMAGE_VARIANTS)[number]['label'];

export const mediaVariant = z.object({
  label: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive().optional(),
  format: z.enum(['webp', 'avif', 'jpeg', 'png']),
  key: z.string(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export type MediaVariant = z.infer<typeof mediaVariant>;
export const mediaVariants = z.array(mediaVariant);
