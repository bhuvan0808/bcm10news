import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildStorageKey } from './keys';
import type { MediaService, SignUploadRequest, SignedUpload } from './types';

/**
 * Cloudflare R2, addressed through its S3-compatible API.
 *
 * Uploads are presigned and go browser -> R2 directly. Routing a 10 MB camera
 * JPEG through a serverless function would burn the request's memory and
 * duration budget for no benefit, and on a slow district connection the
 * reporter would pay for the hop twice.
 *
 * The presigned PUT is bound to the exact content type and length, so a ticket
 * issued for a 2 MB JPEG cannot be replayed to upload a 2 GB video.
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** e.g. https://images.bcm10news.in — the custom domain in front of the bucket. */
  publicBaseUrl: string;
}

export class R2MediaService implements MediaService {
  readonly driver = 'r2' as const;
  readonly bucket: string;

  private readonly client: S3Client;
  private readonly publicBaseUrl: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');

    this.client = new S3Client({
      // R2 ignores the region but the SDK insists on one.
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createSignedUpload(request: SignUploadRequest): Promise<SignedUpload> {
    const storageKey = buildStorageKey({ kind: request.kind, mimeType: request.mimeType });
    const expiresIn = request.expiresInSeconds ?? 300;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: request.mimeType,
      ContentLength: request.sizeBytes,
      // Derivatives are immutable, so tell the CDN it may keep them forever.
      CacheControl: 'public, max-age=31536000, immutable',
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    return {
      uploadUrl,
      storageKey,
      bucket: this.bucket,
      // These must match the signed command exactly or R2 rejects the PUT.
      headers: {
        'Content-Type': request.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  publicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}/${storageKey.replace(/^\/+/, '')}`;
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return true;
    } catch {
      return false;
    }
  }
}
