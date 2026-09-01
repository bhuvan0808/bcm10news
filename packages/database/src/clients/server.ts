import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../generated/database.types';

/** Shape @supabase/ssr hands to setAll. Annotated because the option is
 * optional in the union, so it is not contextually typed. */
type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 *
 * Uses the anon key and the caller's session cookie, so RLS applies exactly as
 * it would in the browser. That is deliberate: the public site should not be
 * able to read anything a reader could not read for themself, which means a
 * mistake in a page cannot leak a premium body or an unpublished story.
 *
 * Use `createAdminClient()` only for the few paths that must bypass RLS —
 * webhooks, cron, and the signed-upload flow.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.'
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session instead, so this is expected and safe to swallow.
        }
      },
    },
  });
}

/**
 * Anonymous client with no session at all, for fully cacheable public reads.
 *
 * Reads through this client are identical for every visitor, which is what
 * makes an ISR-cached page correct: a response generated for one reader can
 * safely be served to the next. Never use it on a page that renders
 * per-reader state.
 */
export function createPublicClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!url || !anonKey) {
    throw new Error('Supabase public credentials are missing. See .env.example.');
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* stateless by design */
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
