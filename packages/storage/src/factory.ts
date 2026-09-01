import type { SupabaseClient } from '@supabase/supabase-js';
import { R2MediaService } from './r2';
import { SupabaseMediaService } from './supabase-storage';
import type { MediaService } from './types';

/**
 * Chooses the driver from the environment.
 *
 * Deliberately fails loudly on a half-configured R2: a missing key discovered
 * at upload time surfaces in front of a reporter mid-story, which is the worst
 * possible moment. `serverEnvSchema` enforces the same rule at boot.
 */
export function createMediaService(options: {
  env?: NodeJS.ProcessEnv;
  supabaseClient?: SupabaseClient;
}): MediaService {
  const env = options.env ?? process.env;
  const driver = env['MEDIA_DRIVER'] === 'r2' ? 'r2' : 'supabase';

  if (driver === 'r2') {
    const accountId = env['R2_ACCOUNT_ID'];
    const accessKeyId = env['R2_ACCESS_KEY_ID'];
    const secretAccessKey = env['R2_SECRET_ACCESS_KEY'];
    const publicBaseUrl = env['R2_PUBLIC_BASE_URL'];
    const bucket = env['R2_BUCKET'] ?? 'bcm10-media';

    if (!accountId || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
      throw new Error(
        'MEDIA_DRIVER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE_URL.'
      );
    }

    return new R2MediaService({ accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl });
  }

  if (!options.supabaseClient) {
    throw new Error(
      'MEDIA_DRIVER=supabase requires a Supabase client (use the service-role client).'
    );
  }

  return new SupabaseMediaService(
    options.supabaseClient,
    env['R2_BUCKET'] ?? 'media',
    env['NEXT_PUBLIC_MEDIA_URL']
  );
}
