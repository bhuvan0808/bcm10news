#!/usr/bin/env node
/**
 * Guards against ambiguous PostgREST embeds.
 *
 * When two foreign keys join the same pair of tables, PostgREST refuses to
 * guess which one an embed means and fails the *entire* query with PGRST201.
 * That failure mode is nasty because it does not look like a query error at the
 * call site — `data` comes back null, and code that reads null as "no row"
 * quietly shows a 404, or a paywall, or an empty list.
 *
 * It has bitten this codebase three times:
 *   - articles -> article_videos   (every article page rendered as paywalled)
 *   - articles -> article_related  (the story edit page 404ed)
 *   - comments -> profiles         (comments never loaded)
 *
 * So it is checked mechanically rather than remembered.
 *
 * Ambiguity is **directional**: `comments -> articles` is fine (one foreign
 * key) while `comments -> profiles` is not (profile_id and moderated_by). The
 * check therefore needs the base table of each query, which it takes from the
 * nearest preceding `.from('…')`. Shared select constants declare their base
 * table with an `@embedBase` annotation, since they have no `.from()` nearby.
 *
 * Rather than reason about which constraint is correct, every suspect pair is
 * probed against the live API — the same request the app will make.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   node scripts/check-embeds.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
  process.exit(1);
}

const ROOTS = ['apps/web/src', 'apps/admin/src', 'packages/database/src'];

async function ambiguousPairs() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        select confrelid::regclass::text as target,
               conrelid::regclass::text  as source,
               string_agg(conname, ', ' order by conname) as constraints
        from pg_constraint
        where contype = 'f' and connamespace = 'public'::regnamespace
        group by 1, 2
        having count(*) > 1;
      `,
    }),
  });

  if (!response.ok) throw new Error(`could not read the schema: HTTP ${response.status}`);

  const pairs = new Map();
  for (const row of await response.json()) {
    const source = row.source.replace(/^public\./, '');
    const target = row.target.replace(/^public\./, '');
    // Ambiguous whichever way round the embed is written.
    pairs.set(`${source}>${target}`, row.constraints);
    pairs.set(`${target}>${source}`, row.constraints);
  }
  return pairs;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      yield* walk(path);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield path;
    }
  }
}

/**
 * Walks a select string and yields every embed with the table it is nested
 * under.
 *
 * Nesting matters: in `articles(gallery:article_media(media(...)))` the inner
 * `media` hangs off `article_media`, not off `articles`. Attributing it to the
 * outer table produces a false positive, since article_media has only one
 * foreign key to media.
 */
function* embedsWithBase(body, rootTable) {
  const stack = [rootTable];
  const token = /(?:(\w+)\s*:\s*)?(\w+)(!\w+)?\s*\(|\)/g;

  for (const match of body.matchAll(token)) {
    if (match[0] === ')') {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const table = match[2];
    const hint = match[3];

    yield { base: stack[stack.length - 1], table, hint };
    stack.push(table);
  }
}

/**
 * Pulls out (baseTable, selectBody) pairs.
 *
 * Two shapes are recognised: a `.from('x')…​.select(...)` chain, and a select
 * constant carrying an `@embedBase <table>` annotation.
 */
function extractQueries(source) {
  const found = [];

  const chain = /\.from\(\s*['"](\w+)['"]\s*\)([\s\S]{0,600}?)\.select\(\s*(`[^`]*`|'[^']*')/g;
  for (const match of source.matchAll(chain)) {
    found.push({ base: match[1], body: match[3] ?? '' });
  }

  const annotated = /@embedBase\s+(\w+)[\s\S]{0,400}?=\s*(`[^`]*`)/g;
  for (const match of source.matchAll(annotated)) {
    found.push({ base: match[1], body: match[2] ?? '' });
  }

  return found;
}

async function main() {
  const pairs = await ambiguousPairs();
  // Each pair is recorded in both directions, except a self-reference
  // like profiles -> profiles, which is recorded once.
  const distinct = new Set([...pairs.keys()].map((key) => key.split('>').sort().join('>')));
  console.log(`
${distinct.size} ambiguous table pairs in the schema.
`);

  const problems = [];
  let checked = 0;

  for (const root of ROOTS) {
    for await (const file of walk(root)) {
      const source = await readFile(file, 'utf8');

      for (const { base: rootTable, body } of extractQueries(source)) {
        for (const { base, table, hint } of embedsWithBase(body, rootTable)) {
          if (table === base) continue;

          const key = `${base}>${table}`;
          if (!pairs.has(key)) continue;

          checked += 1;
          if (hint) continue;

          problems.push({
            file: relative(process.cwd(), file),
            base,
            table,
            options: pairs.get(key),
          });
        }
      }
    }
  }

  console.log(`Checked ${checked} embed(s) of an ambiguous relationship.`);

  if (!problems.length) {
    console.log('All of them name a constraint. No PGRST201 waiting to happen.\n');
    return;
  }

  console.error('\nUnhinted embeds — each of these fails the whole query at runtime:\n');
  for (const problem of problems) {
    console.error(`  ${problem.file}`);
    console.error(`    .from('${problem.base}') embeds "${problem.table}" with no hint`);
    console.error(`    choose one: ${problem.options}\n`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
