'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../generated/database.types';

/**
 * Browser client. Carries the anon key only — every read it performs is
 * filtered by RLS, which is why it is safe to ship.
 *
 * The instance is memoised: creating a second client would start a second
 * auth listener and the two would race on token refresh.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (client) return client;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.'
    );
  }

  client = createBrowserClient<Database>(url, anonKey);
  return client;
}

export type BrowserClient = ReturnType<typeof createClient>;
