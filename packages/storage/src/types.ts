import type { MediaKind } from '@bcm10/validation';

/**
 * The storage seam.
 *
 * The newsroom talks to `MediaService`; it never imports an S3 client. Swapping
 * Cloudflare R2 for another object store is implementing this interface once,
 * not touching the upload UI or the article editor.
 */
export interface SignedUpload {
  /** Where the browser PUTs the bytes. Short-lived. */
  uploadUrl: string;
  /** Immutable key the metadata row will record. */
  storageKey: string;
  bucket: string;
  /** Headers the browser must send verbatim, or the signature will not match. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface SignUploadRequest {
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  /** Seconds the signature stays valid. Kept short — a ticket is used at once. */
  expiresInSeconds?: number;
}

export interface MediaService {
  readonly driver: 'r2' | 'supabase';
  readonly bucket: string;

  /** Issues a direct-to-storage upload URL. Bytes never pass through the app server. */
  createSignedUpload(request: SignUploadRequest): Promise<SignedUpload>;

  /** CDN URL for a stored object. */
  publicUrl(storageKey: string): string;

  deleteObject(storageKey: string): Promise<void>;

  /** Confirms an object actually landed, before a metadata row claims it did. */
  objectExists(storageKey: string): Promise<boolean>;
}

export interface StoredVariant {
  label: string;
  width: number;
  height?: number;
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  key: string;
  sizeBytes?: number;
}
