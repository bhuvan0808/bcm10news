import type { SupabaseClient } from '@supabase/supabase-js';
import { buildStorageKey } from './keys';
import type { MediaService, SignUploadRequest, SignedUpload } from './types';

/**
 * Supabase Storage driver.
 *
 * Exists so the newsroom is usable on day one, before a Cloudflare account and
 * an R2 bucket are in place. It presents the same interface as R2 and returns
 * a URL the browser PUTs to, so the upload code in the admin app is identical
 * under either driver and switching is an environment variable.
 *
 * R2 is the production target: it has no egress charge, which matters for a
 * news site whose images are its bandwidth.
 */
export class SupabaseMediaService implements MediaService {
  readonly driver = 'supabase' as const;

  constructor(
    private readonly client: SupabaseClient,
    readonly bucket: string,
    private readonly publicBaseUrl?: string
  ) {}

  async createSignedUpload(request: SignUploadRequest): Promise<SignedUpload> {
    const storageKey = buildStorageKey({ kind: request.kind, mimeType: request.mimeType });

    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new Error(`Could not sign upload for ${storageKey}: ${error?.message ?? 'unknown error'}`);
    }

    return {
      uploadUrl: data.signedUrl,
      storageKey,
      bucket: this.bucket,
      headers: { 'Content-Type': request.mimeType },
      // Supabase fixes this window at two hours.
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
  }

  publicUrl(storageKey: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${storageKey.replace(/^\/+/, '')}`;
    }
    return this.client.storage.from(this.bucket).getPublicUrl(storageKey).data.publicUrl;
  }

  async deleteObject(storageKey: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([storageKey]);
    if (error) throw new Error(`Could not delete ${storageKey}: ${error.message}`);
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash === -1 ? '' : storageKey.slice(0, lastSlash);
    const name = storageKey.slice(lastSlash + 1);

    const { data } = await this.client.storage.from(this.bucket).list(folder, { search: name, limit: 1 });
    return Boolean(data?.some((entry) => entry.name === name));
  }
}
