import { z } from 'zod';

/**
 * Environment contract.
 *
 * Two schemas, deliberately separate:
 *
 *  - `clientEnvSchema` covers NEXT_PUBLIC_* only. Anything in it is compiled
 *    into the browser bundle.
 *  - `serverEnvSchema` covers secrets. Reading it from a client component
 *    throws at module load rather than shipping a key to a reader.
 *
 * Integrations are optional by design: the platform boots with only Supabase
 * configured, and each provider switches itself on when its keys appear. That
 * is what makes it possible to go live before Razorpay or OneSignal exist.
 */

const url = z.string().url();
const nonEmpty = z.string().min(1);

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: url.default('http://localhost:3000'),
  NEXT_PUBLIC_ADMIN_URL: url.default('http://localhost:3001'),
  NEXT_PUBLIC_SITE_NAME: z.string().default('BCM10 News'),
  NEXT_PUBLIC_MEDIA_URL: url.optional(),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['te', 'en']).default('te'),

  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,

  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: url.default('https://us.i.posthog.com'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_ONESIGNAL_APP_ID: z.string().optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,

  // --- Media -----------------------------------------------------------------
  MEDIA_DRIVER: z.enum(['r2', 'supabase']).default('supabase'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('bcm10-media'),
  R2_PUBLIC_BASE_URL: url.optional(),

  // --- Email -----------------------------------------------------------------
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('BCM10 News <news@bcm10news.in>'),
  RESEND_REPLY_TO: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // --- Payments --------------------------------------------------------------
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // --- Push ------------------------------------------------------------------
  ONESIGNAL_APP_ID: z.string().optional(),
  ONESIGNAL_REST_API_KEY: z.string().optional(),

  // --- Observability ---------------------------------------------------------
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  POSTHOG_API_KEY: z.string().optional(),

  // --- Internal --------------------------------------------------------------
  REVALIDATE_SECRET: z.string().min(16, 'REVALIDATE_SECRET must be at least 16 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * R2 is all-or-nothing: half-configured object storage fails at upload time,
 * in front of a reporter, which is the worst place to discover it.
 */
export const serverEnv = serverEnvSchema.superRefine((env, ctx) => {
  if (env.MEDIA_DRIVER !== 'r2') return;

  for (const key of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_BASE_URL',
  ] as const) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when MEDIA_DRIVER=r2`,
      });
    }
  }
});

export interface IntegrationStatus {
  media: 'r2' | 'supabase';
  email: boolean;
  payments: boolean;
  push: boolean;
  analytics: boolean;
  errors: boolean;
}

/** What is actually wired up. Rendered on the admin health page. */
export function integrationStatus(env: NodeJS.ProcessEnv = process.env): IntegrationStatus {
  return {
    media: env['MEDIA_DRIVER'] === 'r2' ? 'r2' : 'supabase',
    email: Boolean(env['RESEND_API_KEY']),
    payments: Boolean(env['RAZORPAY_KEY_ID'] && env['RAZORPAY_KEY_SECRET']),
    push: Boolean(env['ONESIGNAL_APP_ID'] && env['ONESIGNAL_REST_API_KEY']),
    analytics: Boolean(env['NEXT_PUBLIC_POSTHOG_KEY']),
    errors: Boolean(env['NEXT_PUBLIC_SENTRY_DSN']),
  };
}

/**
 * Parses and caches server env. Throws a readable, aggregated error listing
 * every missing key at once — a slow boot beats a runtime 500 in production.
 */
let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverEnv.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid server environment:\n${details}\n\nSee .env.example for the full contract.`
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function getClientEnv(source: Record<string, string | undefined>): ClientEnv {
  const parsed = clientEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid public environment:\n${details}`);
  }
  return parsed.data;
}

/** Test seam. */
export function resetEnvCache(): void {
  cachedServerEnv = null;
}
