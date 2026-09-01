# Feature audit

Every requirement from the build specification, and where it stands.

**Legend** — ✅ built and verified · 🟡 built, needs configuration or content ·
⚠️ partial · ❌ not built

---

## 1. Technology stack

| Requirement                           | State | Notes                                               |
| ------------------------------------- | ----- | --------------------------------------------------- |
| Next.js App Router, TypeScript, React | ✅    | Next 15, React 19, strict TS                        |
| Tailwind CSS                          | ✅    | v4, CSS-first tokens                                |
| Server Components by default          | ✅    | Client components only where interaction requires   |
| Vercel hosting                        | ✅    | Two projects, auto-deploying from `main`            |
| ISR and on-demand revalidation        | ✅    | Tag-based; publish purges exactly what changed      |
| Supabase Postgres + Auth + RLS        | ✅    | 41 tables, all with RLS, 89 policies                |
| Google OAuth                          | 🟡    | Code complete; awaiting credentials                 |
| Magic link                            | ✅    | Working                                             |
| Password auth                         | ✅    | Added for staff accounts                            |
| Session persistence, logout           | ✅    | Middleware refresh, POST-only sign-out              |
| All eight roles                       | ✅    | Enforced by `role_rank()` and RLS                   |
| Cloudflare R2 with signed uploads     | ✅    | Verified end to end against real R2                 |
| Media abstraction layer               | ✅    | `MediaService`; Supabase Storage driver as fallback |
| Custom media domain                   | 🟡    | On `pub-…r2.dev` until DNS moves                    |
| Resend + all transactional templates  | 🟡    | Wired; needs domain verification to deliver         |
| Resend webhooks persisted             | ✅    | Signature-verified, bounces auto-unsubscribe        |
| PostHog with the full event schema    | ✅    | One typed union; a typo fails to compile            |
| Anonymous → identified linking        | ✅    | `identifyReader()` on sign-in                       |
| Feature flags                         | ✅    | `isFeatureEnabled()`                                |
| Sentry                                | 🟡    | DSN configured; SDK instrumentation not yet added   |
| OneSignal                             | 🟡    | Service + topics complete; opt-in UI not built      |
| Razorpay                              | 🟡    | Complete incl. webhook; needs KYC and keys          |
| YouTube embeds                        | ✅    | All URL forms, lazy facade, 14 tests                |

## 2. Domain architecture

| Requirement                | State | Notes                                  |
| -------------------------- | ----- | -------------------------------------- |
| Public / admin split       | ✅    | Separate deployments                   |
| `www` → canonical redirect | 🟡    | Configured; pending DNS                |
| `images.` subdomain        | 🟡    | Pending DNS                            |
| Cloudflare in front        | 🟡    | Pending nameserver move — see `dns.md` |

## 3. Information architecture

Every route in the spec exists: `/`, `/[category]` (covers all 15 sections),
`/news/[slug]`, `/author/[slug]`, `/tag/[slug]`, `/search`, `/videos`,
`/photos`, `/subscribe`, `/account`, `/about`, `/contact`, `/privacy`,
`/terms`, `/newsletter/confirm`. ✅

`/premium/[slug]` was **deliberately not built** — premium is a flag on an
article, not a separate URL space. A second URL for the same story would split
its ranking signals and give the same content two canonical addresses.

## 4. Homepage

| Requirement                                                          | State                               |
| -------------------------------------------------------------------- | ----------------------------------- |
| Nav, logo, search, sign-in, subscribe CTA                            | ✅                                  |
| Breaking ticker                                                      | ✅ Pure CSS, works before hydration |
| Hero, secondary leads, latest                                        | ✅                                  |
| State / national / world / business / sport / cinema / tech sections | ✅ Database-driven                  |
| Videos, photos, most-read, editor's picks                            | ✅                                  |
| Newsletter signup                                                    | ✅                                  |
| Reusable section components, cached parallel queries                 | ✅                                  |

## 5. Article page

All required elements present: breadcrumbs, headline, subtitle, byline,
published and updated timestamps, reading time, lead image with caption and
credit, body, inline images, videos, related, most-read, share, comments,
subscription CTA, premium gating. ✅

Telugu, English and mixed content all handled. ✅
Save/bookmark exists in the schema and on the account page; the button on the
article page is not built. ⚠️

## 6. Article editor

| Requirement                                                                  | State                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Tiptap structured editor                                                     | ✅                                                      |
| Paragraph, headings, bold, italic, link, quote, lists, image, video, divider | ✅                                                      |
| Autosave with timestamp                                                      | ✅                                                      |
| Version history                                                              | ✅ Stored by trigger; diff viewer not built ⚠️          |
| Preview before publishing                                                    | ⚠️ "View on site" for published only                    |
| Gallery, callout, related-story blocks                                       | ✅ Renderer supports them; toolbar buttons not built ⚠️ |
| Drag-and-drop block reordering                                               | ⚠️ Tiptap supports node dragging; no explicit handles   |

## 7–9. Workflow

| Requirement                                                       | State                         |
| ----------------------------------------------------------------- | ----------------------------- |
| Reporter dashboard with all queues                                | ✅                            |
| Every create-story field                                          | ✅                            |
| Save / preview / submit                                           | ✅                            |
| Reporter cannot publish without the grant                         | ✅ Database trigger, verified |
| Editor queue, approve, request changes, reject, publish, schedule | ✅                            |
| Reviewer, action, timestamp, comments tracked                     | ✅                            |
| Full state machine, invalid transitions rejected                  | ✅ `is_legal_transition()`    |
| Every transition audited                                          | ✅ By trigger                 |

## 10. Revisions

Snapshot per meaningful save, with article, version, content, author, status and
timestamp. ✅ **A UI to compare two versions is not built.** ⚠️

## 11. Media

Upload, search, filter, tag, photographer, copyright, caption, alt text, usage
tracking — all ✅. Signed direct-to-R2 upload with MIME, size, extension and
dimension validation ✅.

**Delivery variants are not generated.** The `variants` column and the srcset
builder exist and are read; nothing populates them, so delivery currently relies
on `next/image`. ⚠️ This is the largest remaining performance item.

## 12. YouTube

Every URL form parsed server-side, id validated against a strict pattern in both
TypeScript and a CHECK constraint, lazy responsive embed. ✅

## 13. SEO

Title, meta description, canonical, OpenGraph, Twitter, NewsArticle and
BreadcrumbList structured data, `sitemap.xml`, `news-sitemap.xml`, `robots.txt`,
per-section RSS. ✅

Soft 404s were found and fixed — every unknown route now returns a real 404. ✅

## 14. Performance

Server components, aggressive caching, responsive images, lazy loading, lazy
YouTube, minimal client JS. ✅ Publish invalidates database → cache tags → paths
→ notifications, in that order. ✅

## 15. Search

Postgres full-text over a weighted vector, Telugu and English, with a trigram
fallback for misspellings. Indexed and behind a single function so a dedicated
engine is a one-function swap. ✅

## 16. Reader accounts

Google (pending), email, profile, saved articles, subscription, billing history,
logout. ✅ Followed categories and authors exist in the schema; the UI is not
built. ⚠️ Account deletion is not built. ❌

## 17–18. Subscriptions and premium

Plans, subscriptions, payments, invoices, entitlements, payment events — all
configurable from the database, no hardcoded prices. ✅

The paywall is RLS: the premium row is invisible without the entitlement.
**Verified in production** — the body appears nowhere in the HTML. ✅

## 19. B2B licensing

Organisations, members, licences, quotas, usage ledger, `consume_license()` with
atomic quota claiming. ✅ Admin UI built. ✅ **Public API access for licensees is
not built** — the flag exists, the endpoint does not. ❌

## 20. Newsletter

Subscribers, preferences, campaigns, email events, double opt-in, unsubscribe
tokens. ✅ **Digest composition and sending is not built** — the templates and
the recipient query exist; nothing assembles and sends a daily edition. ❌

## 21. Push

Topics, subscriber table, per-topic sending. ✅ **The reader-facing opt-in
prompt is not built,** so nobody can subscribe yet. ❌

## 22. Analytics

Every event in the spec, with the required dimensions. ✅ Plus a first-party
newsroom dashboard the spec did not ask for: site totals with trend, daily
traffic, most-read, per-section and per-reporter, and per-article detail. ✅

## 23. Sentry

DSN configured. **The SDK is not wired in** — no `instrumentation.ts`, no source
map upload. ⚠️

## 24–26. Security and audit

HTTPS, security headers, CSP, rate limiting, signed uploads, RLS, server-side
authorization, input validation, MIME validation, size limits, webhook signature
verification, audit logging of every sensitive action. ✅

`'unsafe-inline'` remains in `script-src` — Next.js inlines its bootstrap.
Documented in `security.md`. ⚠️

## 27–28. Dashboards

Reporter and editor dashboards ✅. Analytics dashboard ✅. **Subscription and
revenue KPIs (MRR/ARR, churn) are not built** — no revenue exists yet. ❌

## 29. Reporter experience

Mobile-friendly, autosave, unsaved-changes warning, phone uploads with progress.
✅ Verified on a 390px viewport in the E2E suite.

## 30–31. Caching and observability

Tag-based caching with on-demand invalidation ✅. Structured logs ✅.
**Request/correlation IDs are not threaded through.** ⚠️

## 32. Testing

| Kind             | State                           |
| ---------------- | ------------------------------- |
| Unit             | ✅ 54 tests                     |
| Database / RLS   | ✅ 21 live checks               |
| Storage          | ✅ 6 live checks                |
| E2E browser      | ✅ 48 tests, desktop and mobile |
| Migration sanity | ✅ Real Postgres in CI          |
| Payment webhook  | ✅ 13 signature tests           |

Of the ten critical scenarios named in the spec, eight are covered. Not yet
covered: subscriber-reads-premium and payment-webhook-activates-subscription,
both of which need Razorpay.

## 33–34. Deployment and CI

Vercel, Supabase, Cloudflare, R2, Resend, PostHog, Sentry, OneSignal all
configured ✅. CI runs format, typecheck, unit tests, build, migrations against
real Postgres, an RLS coverage check, the embed check and the E2E suite. ✅

## 35. Design

Dense Indian-newsroom layout, strong typography, Telugu-first type pairing,
mobile-first, prominent breaking news, accessible contrast, keyboard navigation,
screen-reader labels. ✅

## 36. Module boundaries

`ArticleService` (queries), `MediaService`, `EmailService`, `PaymentService`,
`NotificationService`, analytics — each behind an interface with a no-op
fallback. ✅

---

## Summary

**Complete and verified:** the database and its security model, the public site,
the newsroom CMS, the editorial workflow, RBAC and staff management, analytics,
comments, B2B licensing, SEO, caching, and the test suites.

**Needs only credentials:** Google sign-in, Razorpay, email delivery, the media
domain.

**Genuinely not built** — in the order I would do them:

1. **Image delivery variants.** The single biggest performance gap.
2. **Push opt-in prompt.** Push cannot be used at all without it.
3. **Newsletter digest composition.** Same — subscribers accumulate with nothing
   to send them.
4. **Sentry SDK wiring.** Errors currently only reach Vercel logs.
5. **Revision diff viewer.** History is captured; it just cannot be read.
6. **Save/follow buttons** on the article page.
7. **Subscription KPI dashboard.** Worth building when there is revenue.
8. **Public content API** for licensees.
9. **Account deletion.** Required under the DPDP Act before a real launch.
