#!/usr/bin/env node
/**
 * Functional verification against the live database.
 *
 * This is not a unit test. It exercises the rules the schema claims to enforce
 * — the editorial state machine, the publish grant, the paywall — by asking
 * Postgres to break them and checking that it refuses.
 *
 * Everything it creates is rolled back or deleted at the end, so it is safe to
 * run against a live project.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/verify-database.mjs
 */

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function sql(query) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {
      /* raw */
    }
    throw new Error(message);
  }
  return JSON.parse(text);
}

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

/** Runs SQL expected to raise, and returns the error message. */
async function expectFailure(name, query, expectedFragment) {
  try {
    await sql(query);
    check(name, false, 'the statement was accepted but should have been rejected');
  } catch (error) {
    const matches = error.message.toLowerCase().includes(expectedFragment.toLowerCase());
    check(name, matches, matches ? '' : `unexpected error: ${error.message.slice(0, 120)}`);
  }
}

async function main() {
  console.log('\nEditorial state machine\n');

  const transitions = await sql(`
    select
      public.is_legal_transition('draft', 'published')          as draft_to_published,
      public.is_legal_transition('draft', 'submitted')          as draft_to_submitted,
      public.is_legal_transition('submitted', 'approved')       as submitted_to_approved,
      public.is_legal_transition('approved', 'published')       as approved_to_published,
      public.is_legal_transition('archived', 'submitted')       as archived_to_submitted;
  `);

  const t = transitions[0];
  check('draft cannot go straight to published', t.draft_to_published === false);
  check('draft may be submitted', t.draft_to_submitted === true);
  check('submitted may be approved', t.submitted_to_approved === true);
  check('approved may be published', t.approved_to_published === true);
  check('archived cannot be submitted', t.archived_to_submitted === false);

  console.log('\nSchema guarantees\n');

  const [{ count: previewBodyColumns }] = await sql(`
    select count(*)::int as count
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'article_previews'
      and column_name in ('body', 'body_text');
  `);
  check('article_previews exposes no body column', previewBodyColumns === 0);

  const [{ count: noPolicyTables }] = await sql(`
    select count(*)::int as count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  `);
  check('every public table has RLS enabled', noPolicyTables === 0);

  const [{ count: paymentEventPolicies }] = await sql(`
    select count(*)::int as count from pg_policies
    where schemaname = 'public' and tablename = 'payment_events';
  `);
  check('payment_events has no policy (service role only)', paymentEventPolicies === 0);

  console.log('\nConstraints\n');

  await expectFailure(
    'a malformed YouTube id is rejected',
    `do $$
     begin
       insert into public.article_videos (article_id, video_id, original_url)
       values (gen_random_uuid(), 'not-an-id', 'https://youtube.com/watch?v=x');
     end $$;`,
    'article_videos_youtube_id_format'
  );

  /*
   * The publish guard fires even for a superuser connection with no session:
   * can_publish() returns false when auth.uid() is null, so this insert is
   * rejected before the CHECK constraint is ever reached. That is the stronger
   * of the two guarantees, and the one worth asserting — it means the rule
   * holds for a direct psql session, not only for the application.
   */
  await expectFailure(
    'publishing without the grant is rejected, even for a superuser',
    `do $$
     declare v_cat uuid;
     begin
       select id into v_cat from public.categories limit 1;
       insert into public.articles (slug, title, author_id, category_id, status, published_at)
       values ('verify-no-grant', 'x', gen_random_uuid(), v_cat, 'published', null);
     end $$;`,
    'publishing requires the can_publish grant'
  );

  await expectFailure(
    'a three-level category is rejected',
    `do $$
     declare v_parent uuid; v_child uuid;
     begin
       insert into public.categories (slug, name) values ('verify-l1', 'L1') returning id into v_parent;
       insert into public.categories (slug, name, parent_id) values ('verify-l2', 'L2', v_parent) returning id into v_child;
       insert into public.categories (slug, name, parent_id) values ('verify-l3', 'L3', v_child);
     end $$;`,
    'two levels'
  );

  await sql(`delete from public.categories where slug in ('verify-l1','verify-l2','verify-l3');`);

  console.log('\nDerived content\n');

  const [derived] = await sql(`
    select
      public.extract_doc_text('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"},{"type":"text","text":"world"}]}]}'::jsonb) as text,
      public.slugify('Heavy Rain in Hyderabad!') as slug_en,
      public.slugify('హైదరాబాద్‌లో వర్షాలు') as slug_te;
  `);
  check('body text is flattened from the tree', derived.text === 'Hello world', derived.text);
  check(
    'English slugs are hyphenated',
    derived.slug_en === 'heavy-rain-in-hyderabad',
    derived.slug_en
  );
  check(
    'Telugu slugs drop zero-width joiners',
    derived.slug_te === 'హైదరాబాద్లో-వర్షాలు',
    derived.slug_te
  );

  console.log('\nSeeded structure\n');

  const [counts] = await sql(`
    select
      (select count(*)::int from public.categories where is_active) as categories,
      (select count(*)::int from public.homepage_sections where is_active) as sections,
      (select count(*)::int from public.subscription_plans where is_active) as plans,
      (select count(*)::int from public.site_settings) as settings;
  `);
  check('categories seeded', counts.categories >= 15, String(counts.categories));
  check('homepage sections seeded', counts.sections >= 10, String(counts.sections));
  check('subscription plans seeded', counts.plans >= 6, String(counts.plans));
  check('site settings singleton exists', counts.settings === 1, String(counts.settings));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nVerification aborted: ${error.message}`);
  process.exit(1);
});
