import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@bcm10/database/middleware';

/**
 * Newsroom gate.
 *
 * Refreshes the Supabase session (Server Components cannot set cookies) and
 * bounces anonymous requests to sign-in before any page renders.
 *
 * This is a convenience redirect, not the security boundary. RLS decides what
 * a request can actually read, so a bypass here leaks nothing — it just shows
 * someone an empty screen instead of a sign-in form.
 */
const PUBLIC_PATHS = ['/sign-in', '/auth/callback', '/auth/sign-out', '/no-access'];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return response;

  if (!user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/sign-in';
    signIn.search = '';
    // Preserve where they were heading so sign-in can return them to it.
    signIn.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
