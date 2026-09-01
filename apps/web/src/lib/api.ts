import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route-handler helpers.
 */

export function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      // API responses are never cacheable by a shared cache: several of these
      // are per-reader or side-effecting.
      'Cache-Control': 'no-store',
      ...init?.headers,
    },
  });
}

export function badRequest(message: string, details?: unknown) {
  return json({ ok: false, message, details }, { status: 400 });
}

export function unauthorized(message = 'Not authorised') {
  return json({ ok: false, message }, { status: 401 });
}

export function tooManyRequests(retryAfterSeconds: number) {
  return json(
    { ok: false, message: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

export function serverError(message = 'Something went wrong') {
  return json({ ok: false, message }, { status: 500 });
}

/**
 * Constant-time secret comparison for internal endpoints (revalidation, cron).
 *
 * `===` on a secret leaks its length and prefix through timing. This is the
 * same reasoning as the payment signature check, applied to our own tokens.
 */
export function secretMatches(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Guards an internal endpoint.
 *
 * Accepts either `Authorization: Bearer <secret>` (how Vercel Cron calls us)
 * or `x-revalidate-secret` (how the admin app calls us).
 */
export function authoriseInternal(request: NextRequest, secretEnvKey: 'REVALIDATE_SECRET' | 'CRON_SECRET'): boolean {
  const expected = process.env[secretEnvKey];
  if (!expected) return false;

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const header = request.headers.get('x-revalidate-secret');

  return secretMatches(bearer, expected) || secretMatches(header, expected);
}

/**
 * A salted, rotating hash of the caller's IP and user agent.
 *
 * Used to deduplicate article views and to rate-limit without storing an IP
 * address. The daily salt means yesterday's hashes cannot be correlated with
 * today's, so the value is useful for counting and useless for tracking.
 */
export function visitorHash(request: NextRequest): string {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  const userAgent = request.headers.get('user-agent') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env['REVALIDATE_SECRET'] ?? 'bcm10';

  return crypto.createHash('sha256').update(`${day}:${salt}:${ip}:${userAgent}`).digest('hex').slice(0, 32);
}

/**
 * In-process rate limiter.
 *
 * Honest about what this is: a serverless function has no shared memory, so
 * this bounds abuse *per instance*, not globally. The real rate limiting for
 * this site belongs at the Cloudflare edge, in front of the origin, and is
 * configured there (see docs/deployment.md). This exists as a cheap second
 * layer so a single hot instance cannot be hammered by one client, and so
 * local development has the same behaviour as production.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });

    // Opportunistic sweep so the map cannot grow without bound.
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { ok: true, retryAfter: 0 };
}

/** Device bucket for analytics. Coarse on purpose — no fingerprinting. */
export function deviceKind(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  if (/bot|crawler|spider|crawling/i.test(userAgent)) return 'bot';
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}
