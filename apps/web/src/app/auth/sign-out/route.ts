import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@bcm10/database/server';

/**
 * Sign out.
 *
 * POST only. A GET sign-out can be triggered by any image tag or link on
 * another site, which is a small but real CSRF nuisance.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
