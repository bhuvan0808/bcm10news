# Deployment

Every account to create and every key to produce, in the order that makes sense.

The platform is built so it can go live in stages. **Only step 1 is required to have a working
newsroom and a public site.** Each later service switches itself on when its keys appear, so you
can publish before Razorpay, OneSignal or Sentry exist.

---

## What is needed, and when

| Stage | Service        | Required?               | Without it                               |
| ----- | -------------- | ----------------------- | ---------------------------------------- |
| 1     | Supabase       | **Yes**                 | Nothing works                            |
| 2     | Vercel         | **Yes**                 | Nothing is deployed                      |
| 3     | Cloudflare DNS | Yes for the real domain | Vercel URLs only                         |
| 4     | Cloudflare R2  | Recommended             | Images fall back to Supabase Storage     |
| 5     | Resend         | Recommended             | No email at all                          |
| 6     | PostHog        | Optional                | No analytics                             |
| 7     | Sentry         | Optional                | Errors only in Vercel logs               |
| 8     | Razorpay       | When monetising         | Subscribe page shows "register interest" |
| 9     | OneSignal      | Optional                | No breaking-news push                    |

---

## 1. Supabase — required

1. Create a project at [supabase.com](https://supabase.com). Choose the **Mumbai (ap-south-1)**
   region — every reader and reporter is in India, and the round trip matters.
2. Set a strong database password and record it in a password manager.
3. From **Project Settings → API**, take:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **server only, never in a browser bundle**
   - Project reference id → `SUPABASE_PROJECT_REF`

Then apply the schema:

```bash
npx supabase login
npm run db:link          # uses SUPABASE_PROJECT_REF
npm run db:push          # applies supabase/migrations in order
npm run db:seed          # sections, datelines, plans — safe to re-run
npm run db:types         # regenerate database.types.ts from the live schema
```

`db:types` matters: `packages/database/src/generated/database.types.ts` is currently a
hand-written stand-in written to match the migrations. Replacing it with the generated file is a
drop-in change.

### Google sign-in

**Authentication → Providers → Google**, then in Google Cloud Console create an OAuth 2.0 client
with these redirect URIs:

```text
https://<project-ref>.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
https://bcm10news.in/auth/callback
https://admin.bcm10news.in/auth/callback
```

### Make yourself super admin

The auth trigger creates every new user as a `reader`. Promote the first account by hand, in the
SQL editor, after signing in once:

```sql
update public.profiles
   set role = 'super_admin',
       can_publish = true,
       can_send_push = true,
       can_manage_media_library = true,
       slug = 'bhuvan-boddu'
 where email = 'you@example.com';
```

Every other role is then assignable from the newsroom.

---

## 2. Vercel — required

Two projects from the same repository.

**Public site**

- Root directory: `apps/web`
- Framework: Next.js (detected)
- Build: `cd ../.. && npm run build --workspace @bcm10/web`
- Install: `npm install`

**Newsroom**

- Root directory: `apps/admin`
- Build: `cd ../.. && npm run build --workspace @bcm10/admin`

Generate the two internal secrets once and set the **same values in both projects**:

```bash
openssl rand -hex 32   # REVALIDATE_SECRET
openssl rand -hex 32   # CRON_SECRET
```

`REVALIDATE_SECRET` is how the newsroom tells the public site to drop a cached story. If the two
projects disagree, publishing silently stops purging the cache and stories appear late.

`apps/web/vercel.json` already declares the cron jobs; Vercel picks them up automatically:

| Path                          | Schedule        | Purpose                               |
| ----------------------------- | --------------- | ------------------------------------- |
| `/api/cron/publish-scheduled` | every minute    | Publishes stories whose time has come |
| `/api/cron/refresh-trending`  | every 5 minutes | Rebuilds "most read"                  |

> If scheduled stories stop going out, this cron is the first thing to check. The
> **Scheduled** page in the newsroom flags anything past its publish time.

---

## 3. Cloudflare — DNS, CDN and WAF

Keep the domain registered at GoDaddy; only change the nameservers.

1. Add `bcm10news.in` to Cloudflare.
2. Replace the GoDaddy nameservers with the pair Cloudflare gives you. Propagation is usually
   under an hour.
3. Records:

| Name           | Type    | Target           | Proxy   |
| -------------- | ------- | ---------------- | ------- |
| `bcm10news.in` | CNAME/A | Vercel target    | Proxied |
| `www`          | CNAME   | `bcm10news.in`   | Proxied |
| `admin`        | CNAME   | Vercel target    | Proxied |
| `images`       | CNAME   | R2 custom domain | Proxied |

4. **SSL/TLS → Full (strict)**.
5. **Security → WAF → Rate limiting.** The in-process limiter in `apps/web/src/lib/api.ts` is a
   second layer only — a serverless function has no shared memory, so real rate limiting belongs
   here. Suggested rules:

| Path              | Limit                                                    |
| ----------------- | -------------------------------------------------------- |
| `/api/newsletter` | 5 requests / 5 min / IP                                  |
| `/api/track/view` | 60 requests / min / IP                                   |
| `/api/webhooks/*` | 100 requests / min (Razorpay and Resend retry in bursts) |
| `/search`         | 30 requests / min / IP                                   |

---

## 4. Cloudflare R2 — images

Free tier: 10 GB storage, and **no egress charge**, which is the reason to prefer it for a site
whose bandwidth is mostly photographs.

1. **R2 → Create bucket** → `bcm10-media`.
2. **Settings → Custom domain** → `images.bcm10news.in`. This is what puts images behind
   Cloudflare's cache instead of hitting the bucket on every request.
3. **Manage R2 API Tokens** → create a token with _Object Read & Write_ on that bucket.
4. CORS on the bucket, so the browser can upload directly:

```json
[
  {
    "AllowedOrigins": ["https://admin.bcm10news.in", "http://localhost:3001"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

Then set `MEDIA_DRIVER=r2` plus `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `R2_PUBLIC_BASE_URL`.

Leave `MEDIA_DRIVER=supabase` until all five are set. R2 is deliberately all-or-nothing: a
half-configured bucket fails at upload time, in front of a reporter.

---

## 5. Resend — email

1. Add and verify `bcm10news.in` (SPF, DKIM and DMARC records, all in Cloudflare DNS).
2. Create an API key → `RESEND_API_KEY`.
3. Add a webhook to `https://bcm10news.in/api/webhooks/resend`, subscribed to
   `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`,
   `email.clicked`. Its signing secret → `RESEND_WEBHOOK_SECRET`.

The webhook is not decoration: a hard bounce or spam complaint automatically unsubscribes the
address, which is what protects the sending domain's reputation.

---

## 6. PostHog

Create a project, take the **Project API Key** → `NEXT_PUBLIC_POSTHOG_KEY`, and set
`NEXT_PUBLIC_POSTHOG_HOST` to the matching region host.

Autocapture is deliberately off — on a news site it produces enormous volumes of link clicks that
duplicate `article_view` while telling you less.

---

## 7. Sentry

Create an organisation and two projects (`bcm10-web`, `bcm10-admin`). Take the DSN →
`NEXT_PUBLIC_SENTRY_DSN`, plus `SENTRY_ORG`, `SENTRY_PROJECT` and an auth token for source-map
upload.

---

## 8. Razorpay

1. Complete KYC — this takes days, so start it early.
2. **Settings → API Keys** → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. The key id is also
   `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public by design).
3. **Settings → Webhooks** → `https://bcm10news.in/api/webhooks/razorpay`, subscribed to
   `payment.captured`, `payment.failed`, `payment.authorized`, `refund.processed`,
   `subscription.activated`, `subscription.charged`, `subscription.cancelled`,
   `subscription.halted`. Its secret → `RAZORPAY_WEBHOOK_SECRET`.

Test with Razorpay's test keys first. **The webhook is the authority on who has paid** — the
browser callback is treated as a hint and grants nothing.

---

## 9. OneSignal

Create a Web Push app for `bcm10news.in`, then take `ONESIGNAL_APP_ID` (also
`NEXT_PUBLIC_ONESIGNAL_APP_ID`) and `ONESIGNAL_REST_API_KEY`.

---

## Environment variable summary

Set in **both** Vercel projects unless noted.

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://bcm10news.in
NEXT_PUBLIC_ADMIN_URL=https://admin.bcm10news.in
REVALIDATE_SECRET=
CRON_SECRET=                      # web project only

# Media
MEDIA_DRIVER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=bcm10-media
R2_PUBLIC_BASE_URL=https://images.bcm10news.in
NEXT_PUBLIC_MEDIA_URL=https://images.bcm10news.in

# Optional integrations
RESEND_API_KEY=
RESEND_FROM_EMAIL="BCM10 News <news@bcm10news.in>"
RESEND_WEBHOOK_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
NEXT_PUBLIC_ONESIGNAL_APP_ID=
```

---

## Before going live

- [ ] Migrations applied; `npm run db:types` regenerated and committed
- [ ] Every public table shows RLS enabled in Supabase's advisor (CI checks this too)
- [ ] First super admin promoted
- [ ] `REVALIDATE_SECRET` identical in both projects
- [ ] Cron jobs visible in Vercel and running
- [ ] A test story: reporter files → editor reviews → publishes → appears within a minute
- [ ] A test image: uploads, appears at `images.bcm10news.in`, has alt text
- [ ] `/sitemap.xml`, `/news-sitemap.xml`, `/rss.xml` all return content
- [ ] Google Search Console verified, both sitemaps submitted
- [ ] Privacy policy and terms reviewed by a lawyer — the drafts in `apps/web/src/app/privacy`
      and `/terms` describe what the system actually does, but they are not legal advice
- [ ] Razorpay tested end to end with test keys before switching to live
