import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../generated/database.types';

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Legitimate callers are narrow and deliberate:
 *   • payment and email webhook handlers (no user session exists)
 *   • cron jobs (publish scheduled stories, refresh trending)
 *   • the signed-upload flow, which writes an upload ticket on the caller's behalf
 *   • administrative scripts
 *
 * Everything else must use the session-scoped server client so that RLS stays
 * the enforcement point. If you reach for this to "make a query work", the
 * query is telling you a policy is wrong.
 */
let adminClient: ReturnType<typeof createSupabaseClient<Database>> | undefined;

export function createAdminClient() {
  // A bundler that pulled this into a client chunk would ship the service-role
  // key to the browser. Fail loudly instead.
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() was called in the browser. The service-role key must never leave the server.'
    );
  }

  if (adminClient) return adminClient;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin operations (webhooks, cron, uploads).'
    );
  }

  adminClient = createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-bcm10-client': 'admin' },
    },
  });

  return adminClient;
}

export type AdminClient = ReturnType<typeof createAdminClient>;
