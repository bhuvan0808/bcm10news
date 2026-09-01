import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '../generated/database.types';

type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

/**
 * Session refresh for Next.js middleware.
 *
 * Server Components cannot write cookies, so the refreshed access token has to
 * be written here or a reader gets logged out when their token expires
 * mid-session.
 *
 * `getUser()` rather than `getSession()`: getSession() trusts whatever is in
 * the cookie, while getUser() revalidates it with the auth server. In
 * middleware, which is the place authorization decisions are made, only the
 * verified answer is safe.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: { id: string; email?: string } | null;
}> {
  let response = NextResponse.next({ request });

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!url || !anonKey) {
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user: user ? { id: user.id, email: user.email } : null };
}
