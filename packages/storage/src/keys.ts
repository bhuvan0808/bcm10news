import type { MediaKind } from '@bcm10/validation';

/**
 * Storage key construction.
 *
 * Keys are immutable and content-addressed by a random id rather than by the
 * uploaded filename. That buys three things:
 *
 *  • the public URL can be cached forever, because a key never changes meaning
 *  • two reporters uploading `IMG_1234.jpg` cannot collide
 *  • a filename from a phone cannot smuggle a path, an extension mismatch or a
 *    control character into the object store
 *
 * The date prefix keeps bucket listings navigable for a human doing archive
 * work; it is not used for lookup.
 */

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

const PREFIX_BY_KIND: Record<MediaKind, string> = {
  image: 'images',
  avatar: 'avatars',
  document: 'documents',
  audio: 'audio',
};

export function extensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

export interface BuildKeyOptions {
  kind: MediaKind;
  mimeType: string;
  /** Injectable for deterministic tests. */
  id?: string;
  now?: Date;
}

export function buildStorageKey({ kind, mimeType, id, now = new Date() }: BuildKeyOptions): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const objectId = id ?? crypto.randomUUID();
  return `${PREFIX_BY_KIND[kind]}/${year}/${month}/${objectId}.${extensionForMime(mimeType)}`;
}

/**
 * Derives a variant key from the original, so a derivative always sits beside
 * the file it came from: `images/2026/09/<id>.jpg` -> `images/2026/09/<id>_800.webp`.
 */
export function buildVariantKey(originalKey: string, width: number, format = 'webp'): string {
  const withoutExtension = originalKey.replace(/\.[^./]+$/, '');
  return `${withoutExtension}_${width}.${format}`;
}
