# BCM10 News

Production news platform for [bcm10news.in](https://bcm10news.in) — a Telugu and English
newsroom covering Andhra Pradesh and Telangana.

Two applications share one database and one set of service packages:

- **`apps/web`** — the public site. Aggressively cached, mobile-first, built to be read on a
  district 3G connection.
- **`apps/admin`** — the newsroom CMS. Reporters file, editors review, stories publish.

---

## The one thing to understand first

**The database enforces the rules, not the application code.**

This is the decision everything else follows from:

| Rule                                         | Where it lives                               |
| -------------------------------------------- | -------------------------------------------- |
| A reporter cannot publish directly           | `guard_publish_permission()` trigger         |
| A draft cannot skip review                   | `is_legal_transition()` + transition trigger |
| A non-subscriber cannot read a premium story | RLS policy on `articles`                     |
| A reporter cannot read another's draft       | RLS policy on `articles`                     |
| Every revision is recorded                   | `snapshot_article_revision()` trigger        |
| A privilege cannot be self-granted           | `guard_profile_privileges()` trigger         |

The apps mirror these rules so the UI can grey out a button instead of showing an error — but
they never _decide_. A bug in a page cannot leak a premium article, because the row is not
returned in the first place.

The paywall is the clearest example. `article_previews` is a view exposing headline, image and
metadata for every published story. The `articles` table itself is behind RLS. A reader without
the `premium_content` entitlement gets the preview and nothing else, so there is no body in the
server's memory that a rendering mistake could reveal.

---

## Quick start

```bash
npm install
cp .env.example apps/web/.env.local     # fill in Supabase values
cp .env.example apps/admin/.env.local

npm run db:link                          # supabase link --project-ref …
npm run db:push                          # apply migrations
npm run db:seed                          # sections, datelines, plans
npm run db:types                         # regenerate database.types.ts

npm run dev                              # web on :3000, admin on :3001
```

Docker is **not** required. The project targets hosted Supabase; `supabase link` and
`supabase db push` work over the network. `supabase start` is optional and only for a local stack.

---

## Layout

```text
apps/
  web/          Public site — Next.js App Router
  admin/        Newsroom CMS — Next.js App Router

packages/
  validation/   Zod schemas, YouTube parsing, slug rules, content helpers
  database/     Supabase clients, typed queries, cache-tag vocabulary
  storage/      R2 signed uploads, image delivery
  email/        Resend + templates
  payments/     Razorpay, webhook interpretation
  notifications/ OneSignal web push
  analytics/    PostHog, one typed event union
  ui/           Shared primitives
  config/       tsconfig presets

supabase/
  migrations/   Schema, RLS, triggers, RPCs — applied in filename order
  seed.sql      Idempotent structural seed
```

Each service package hides its vendor behind an interface, and each falls back to a no-op when
its keys are absent. **The platform runs end to end with only Supabase configured.** Payments are
the deliberate exception: an unconfigured `PaymentService` throws rather than pretending, because
a checkout that appears to work and takes no money is worse than one that plainly refuses.

---

## Commands

| Command             | Does                                                |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Both apps, in parallel                              |
| `npm run build`     | Build everything                                    |
| `npm run typecheck` | Type-check every workspace                          |
| `npm run test`      | Unit tests                                          |
| `npm run format`    | Prettier                                            |
| `npm run db:push`   | Apply migrations to the linked project              |
| `npm run db:types`  | Regenerate `database.types.ts` from the live schema |
| `npm run db:lint`   | Supabase's own schema linter                        |

---

## Caching

Publishing one story must not rebuild the site, and must not leave a stale front page.

Every cached read is tagged from `packages/database/src/cache-tags.ts`. On publish, the admin
calls `POST /api/revalidate` on the public site with `REVALIDATE_SECRET`, and exactly the affected
tags are dropped: that story, its section, the homepage, the sitemap, the feeds.

The `revalidate` timers are a safety net for a missed invalidation, not the mechanism.

---

## Documentation

- [`docs/deployment.md`](docs/deployment.md) — every account to create, every key, in order
- [`docs/architecture.md`](docs/architecture.md) — why the design is what it is
- [`docs/newsroom.md`](docs/newsroom.md) — how reporters and editors use the CMS
- [`docs/security.md`](docs/security.md) — the security model and its known gaps

---

## Status

| Area                             | State                                                 |
| -------------------------------- | ----------------------------------------------------- |
| Database, RLS, workflow triggers | Complete                                              |
| Public site                      | Complete                                              |
| Newsroom CMS                     | Complete — editor, review, media, schedule            |
| Email, push, analytics, errors   | Wired, dormant until keys are set                     |
| Payments                         | Wired end to end; needs a Razorpay account to go live |
| B2B licensing                    | Schema and quota logic complete; admin UI outstanding |
| Comments                         | Schema and moderation policy complete; UI outstanding |
| E2E tests                        | Outstanding                                           |

See `docs/deployment.md` for what to do next.
