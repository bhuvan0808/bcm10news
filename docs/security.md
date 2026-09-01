# Security model

What protects what, and where the gaps are.

---

## The boundary

Postgres is the security boundary. Not middleware, not the UI.

Every table in `public` has RLS enabled. A table with RLS on and no policy denies everything to
`anon` and `authenticated` — that is the intended posture for `payment_events`, which only the
service role touches.

Application-level checks (`requireEditorial()`, hidden buttons) exist so the UI can fail early
with a readable message. **They are not the boundary.** If a policy is missing they will not save
you; if a policy is right, a bug in them is a UX problem, not a breach.

---

## Client keys

| Key                                 | Where it may appear                           |
| ----------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Browser. Safe — every read is filtered by RLS |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`       | Browser. Public by design                     |
| `NEXT_PUBLIC_POSTHOG_KEY`           | Browser. Write-only ingest key                |
| `SUPABASE_SERVICE_ROLE_KEY`         | **Server only.** Bypasses RLS entirely        |
| `RAZORPAY_KEY_SECRET`               | Server only                                   |
| `R2_SECRET_ACCESS_KEY`              | Server only                                   |
| `RESEND_API_KEY`                    | Server only                                   |
| `REVALIDATE_SECRET` / `CRON_SECRET` | Server only                                   |

`createAdminClient()` throws if it is ever constructed in a browser context, so a bundler mistake
that pulled it into a client chunk fails loudly rather than shipping the service-role key.

### Where the service role is legitimately used

Only four places, all without a user session:

- payment and email webhook handlers
- cron jobs (scheduled publish, trending refresh)
- the signed-upload flow, which writes an upload ticket
- the newsletter confirmation page, which validates a single-use token

Everything else uses the session-scoped client so RLS applies. Reaching for the admin client to
"make a query work" means a policy is wrong.

---

## The paywall

Not a UI state. A premium article's row is invisible to a reader without the `premium_content`
entitlement:

```sql
create policy "articles: entitled readers see premium"
  on public.articles for select
  using (status = 'published' and is_premium and public.has_entitlement('premium_content'));
```

The teaser comes from `article_previews`, a view with no body column. The server never holds the
full text for an unauthorised reader, so there is nothing for a rendering mistake to leak, and
nothing in view-source.

---

## Signature verification

Both webhook handlers verify before parsing, and both use `crypto.timingSafeEqual`. A `===`
comparison on a signature returns early at the first differing byte, which leaks enough timing
information to reconstruct a valid signature.

**Razorpay** — HMAC-SHA256 over the raw request text. The raw body matters: verifying against a
re-serialised object fails intermittently because `JSON.parse`/`stringify` does not preserve key
order or whitespace.

**Resend** — Svix headers, `id.timestamp.body`, with a five-minute window so a captured request
cannot be replayed later.

Both are idempotent by provider event id, so retries are safe.

---

## Input validation

Zod at the edge, mirroring the database's CHECK constraints, so a bad value is rejected with a
readable message rather than surfacing as a constraint violation.

Two spots worth calling out:

**YouTube ids** are matched against `^[A-Za-z0-9_-]{11}$` in TypeScript _and_ in a CHECK
constraint, and the host is checked against an allowlist. `youtube.com.evil.example` does not
parse. Nothing but a verified 11-character id ever reaches an iframe `src`.

**Article bodies** are validated against a closed set of node and mark types. An unknown node is
rejected on write and dropped on render. Link hrefs are protocol-checked, so a stored
`javascript:` URL never becomes a live link.

---

## Uploads

1. MIME type and size are validated **before** anything is signed.
2. The presigned PUT is bound to that exact content type and length, so a ticket for a 2 MB JPEG
   cannot be replayed to upload a 2 GB file.
3. The ticket records who asked. Confirmation checks the requester matches, so one reporter cannot
   claim another's upload.
4. The server verifies the object actually landed before writing the media row.
5. Filenames are never used as storage keys — the key is server-generated, so a filename cannot
   smuggle a path traversal.

---

## Privilege escalation

`profiles` has an "update own" policy, which alone would let any reader make themself an editor —
RLS cannot express column-level restrictions. `guard_profile_privileges()` closes it: `role`,
`can_publish`, `can_send_push`, `can_manage_media_library` and `is_active` can only be changed by
a super admin, and every change is written to `audit_logs`.

---

## Privacy

Reading is measured against a **rotating daily hash** of IP plus user agent, salted with a server
secret. Raw IPs are not stored for analytics. Yesterday's hashes cannot be correlated with
today's, which makes the value useful for counting and useless for tracking.

`audit_logs` does store an IP for security-relevant actions (auth, payment, licence access), where
there is a legitimate interest in doing so.

The newsletter subscriber list is not readable by anonymous callers at all. Sign-up goes through a
`SECURITY DEFINER` function that can insert into a table it cannot read.

---

## Headers

The public site sets HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` and a CSP whose
`frame-src` allows only YouTube and Razorpay.

The newsroom adds `X-Robots-Tag: noindex, nofollow, noarchive` and a same-origin referrer policy.

---

## Known gaps

**`'unsafe-inline'` in `script-src`.** Next.js inlines its bootstrap and hydration payloads.
Removing it requires generating a nonce in middleware and threading it through. Tracked, not
forgotten.

**Rate limiting is per-instance.** `apps/web/src/lib/api.ts` bounds abuse within one serverless
instance, which is not the same as bounding it globally. Real limiting belongs at the Cloudflare
edge; the suggested rules are in `deployment.md`.

**No automated RLS test suite.** CI proves every table has RLS enabled, and that the migrations
apply cleanly to a real Postgres. It does not yet assert that each policy admits and denies the
right rows. That is the highest-value test gap.

**Comments are unmoderated by default.** `is_approved` defaults to false and comments are off
site-wide until enabled, so this is safe as shipped — but turning comments on without a moderation
rota would not be.

---

## Reporting a vulnerability

Email `security@bcm10news.in`. Please do not open a public issue.
