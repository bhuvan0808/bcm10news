#!/usr/bin/env node
/**
 * Creates and configures the two Vercel projects.
 *
 * Idempotent: re-running updates existing projects and upserts environment
 * variables rather than failing on conflict, so it can be used to roll a
 * rotated key out to both projects.
 *
 * Reads secrets from the environment, never from this file.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/setup-vercel.mjs
 */

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID; // optional; personal scope if unset

if (!token) {
  console.error('VERCEL_TOKEN is required.');
  process.exit(1);
}

const API = 'https://api.vercel.com';
const teamQuery = teamId ? `?teamId=${teamId}` : '';

async function api(path, options = {}) {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${API}${path}${teamId ? `${separator}teamId=${teamId}` : ''}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return { ok: response.ok, status: response.status, body };
}

/**
 * Environment variables shared by both apps.
 *
 * `type` matters: anything not prefixed NEXT_PUBLIC_ is created as
 * `encrypted`, so it is write-only in the dashboard and never exposed to the
 * build's client bundle by accident.
 */
function sharedEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SB_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SB_ANON,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SB_SERVICE,

    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL,
    NEXT_PUBLIC_ADMIN_URL: process.env.ADMIN_URL,
    NEXT_PUBLIC_SITE_NAME: 'BCM10 News',

    MEDIA_DRIVER: 'r2',
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
    NEXT_PUBLIC_MEDIA_URL: process.env.R2_PUBLIC_BASE_URL,

    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: 'BCM10 News <onboarding@resend.dev>',

    NEXT_PUBLIC_POSTHOG_KEY: process.env.POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',

    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: 'buvn',
    SENTRY_PROJECT: 'bcm10news',

    ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
    NEXT_PUBLIC_ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
    ONESIGNAL_REST_API_KEY: process.env.ONESIGNAL_REST_API_KEY,

    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  };
}

const PROJECTS = [
  {
    name: 'bcm10news',
    rootDirectory: 'apps/web',
    // Only the public site runs cron, so only it needs the cron secret.
    extraEnv: () => ({ CRON_SECRET: process.env.CRON_SECRET }),
  },
  {
    name: 'bcm10news-admin',
    rootDirectory: 'apps/admin',
    extraEnv: () => ({}),
  },
];

async function ensureProject(spec) {
  const existing = await api(`/v9/projects/${spec.name}`);

  if (existing.ok) {
    console.log(`  project ${spec.name}: exists`);
    await api(`/v9/projects/${spec.name}`, {
      method: 'PATCH',
      body: JSON.stringify({
        framework: 'nextjs',
        rootDirectory: spec.rootDirectory,
      }),
    });
    return existing.body;
  }

  const created = await api('/v11/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: spec.name,
      framework: 'nextjs',
      rootDirectory: spec.rootDirectory,
    }),
  });

  if (!created.ok) {
    throw new Error(`could not create ${spec.name}: ${JSON.stringify(created.body).slice(0, 300)}`);
  }

  console.log(`  project ${spec.name}: created`);
  return created.body;
}

async function upsertEnv(projectName, vars) {
  const entries = Object.entries(vars).filter(([, value]) => value != null && value !== '');

  // One call with upsert=true handles both "new" and "already exists".
  const payload = entries.map(([key, value]) => ({
    key,
    value: String(value),
    // NEXT_PUBLIC_ values end up in the browser bundle regardless, so marking
    // them plain keeps them readable in the dashboard; everything else is
    // encrypted and write-only.
    type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted',
    target: ['production', 'preview', 'development'],
  }));

  const result = await api(`/v10/projects/${projectName}/env?upsert=true`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    throw new Error(
      `could not set env for ${projectName}: ${JSON.stringify(result.body).slice(0, 400)}`
    );
  }

  const failed = result.body?.failed ?? [];
  console.log(
    `  env ${projectName}: ${entries.length - failed.length}/${entries.length} set` +
      (failed.length ? ` (failed: ${failed.map((f) => f.error?.key).join(', ')})` : '')
  );
}

async function main() {
  console.log(`\nVercel setup${teamId ? ` (team ${teamId})` : ''}\n`);

  for (const spec of PROJECTS) {
    await ensureProject(spec);
    await upsertEnv(spec.name, { ...sharedEnv(), ...spec.extraEnv() });
  }

  console.log('\nDone.\n');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
