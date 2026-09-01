#!/usr/bin/env node
/**
 * Applies supabase/migrations to a hosted project via the Management API.
 *
 * Why this exists rather than `supabase db push`: `db push` needs the database
 * password, while the Management API accepts the account access token. That
 * makes this runnable from CI or a fresh machine with one secret instead of
 * two.
 *
 * It records each file in `supabase_migrations.schema_migrations`, the same
 * table the CLI uses, so a later `supabase db push` sees the correct history
 * and does not try to re-apply anything.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/apply-migrations.mjs [--seed]
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const SEED_FILE = join(ROOT, 'supabase', 'seed.sql');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const runSeed = process.argv.includes('--seed');

if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function runSql(sql, label) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();

  if (!response.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.message ?? parsed.error ?? text;
    } catch {
      /* keep the raw body */
    }
    throw new Error(`${label} failed (HTTP ${response.status}): ${detail}`);
  }

  return text;
}

async function main() {
  // The CLI's bookkeeping table. Creating it here means this script and
  // `supabase db push` agree on what has already run.
  await runSql(
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (
       version text primary key,
       statements text[],
       name text
     );`,
    'migration history setup'
  );

  const appliedRaw = await runSql(
    'select version from supabase_migrations.schema_migrations order by version;',
    'read history'
  );
  const applied = new Set(JSON.parse(appliedRaw).map((row) => row.version));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  let appliedCount = 0;

  for (const file of files) {
    // Supabase versions a migration by the timestamp prefix of its filename.
    const version = file.split('_')[0];

    if (applied.has(version)) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }

    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  apply ${file} … `);

    await runSql(sql, file);

    // Record it. The name is escaped for the SQL literal; migration filenames
    // are ours and contain no quotes, but never assume.
    await runSql(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ('${version}', '${file.replace(/'/g, "''")}')
       on conflict (version) do nothing;`,
      `record ${file}`
    );

    console.log('ok');
    appliedCount += 1;
  }

  console.log(
    `\n${appliedCount} migration(s) applied, ${files.length - appliedCount} already present.`
  );

  if (runSeed) {
    process.stdout.write('  seed  supabase/seed.sql … ');
    await runSql(await readFile(SEED_FILE, 'utf8'), 'seed');
    console.log('ok');
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
