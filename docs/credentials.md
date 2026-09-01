# Credentials

What is configured, where it lives, and what needs attention.

> **Every credential used to set this up was pasted into a chat transcript and
> should be treated as compromised.** Rotating them is not paranoia — a chat log
> is not a secret store. The table below is ordered by how much damage each one
> could do.

---

## Rotate these

| Secret                              | Risk if leaked                                                                                     | Priority                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **GitHub PAT** (`ghp_…`)            | Full read/write to every repository on the account. Can push code that then deploys automatically. | **Revoke now** — it has done its job |
| **Supabase service_role key**       | Bypasses RLS completely. Read or alter any row, including auth data.                               | **High**                             |
| **Supabase access token** (`sbp_…`) | Full control of every Supabase project on the account, including deletion.                         | **High**                             |
| **Vercel token** (`vcp_…`)          | Deploy arbitrary code to both sites; read every environment variable.                              | **High**                             |
| **R2 secret key**                   | Read, overwrite and delete every media object.                                                     | **Medium**                           |
| **Razorpay keys**                   | Not yet supplied. When they are, treat as highest — they move money.                               | —                                    |
| **Resend key**                      | Send mail as your domain once verified. Reputation damage.                                         | **Medium**                           |
| **Sentry token**                    | Read error data, which can contain request context.                                                | **Low**                              |
| **OneSignal key**                   | Send push notifications to every subscriber.                                                       | **Medium**                           |
| **PostHog key**                     | Public by design — it is in the browser bundle. No action.                                         | None                                 |

### How to rotate

1. Create the replacement in the vendor dashboard.
2. Update it in both Vercel projects — `scripts/setup-vercel.mjs` does both at
   once, so they cannot drift.
3. Redeploy.
4. Delete the old credential.

The two that are ours rather than a vendor's — `REVALIDATE_SECRET` and
`CRON_SECRET` — were generated during setup and have not been exposed. They
still need to match across both projects and the GitHub Actions secret if you
change them.

---

## Scope problems worth fixing

**The Cloudflare token has no expiry and no IP restriction.** You asked whether
that matters: yes, but its _scope_ matters more, and the scope is currently
fine — it is R2-only. When I tried to use it to deploy a Worker it was correctly
refused. So:

- Keep the narrow permissions. Do not widen it to "All account resources".
- Add an expiry — a year is reasonable. A token that never expires is one you
  will never think about again.
- IP restriction is impractical here, since Vercel's build and function IPs are
  not stable. Skip it.
- If you want the cron Worker, create a **second, separate** token with
  `Workers Scripts: Edit` rather than widening this one.

**The Sentry token could not read the organisation**, only projects. That is
correct least privilege and needs no change.

---

## What is configured

| Service       | State                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Supabase      | Project `kzlquigwistjdscnwilh`, ap-south-1. 15 migrations applied, seeded, 41 tables with RLS |
| Vercel        | `bcm10news` and `bcm10news-admin`, both linked to GitHub, auto-deploying from `main`          |
| Cloudflare R2 | Bucket `bcm10news`, CORS set, public URL live, upload path verified end to end                |
| Resend        | Domain registered, **DNS records pending** — see `docs/dns.md`                                |
| PostHog       | Key set; events flow once there is traffic                                                    |
| Sentry        | DSN set for project `bcm10news`                                                               |
| OneSignal     | App `ba38f031-a977-4ea9-aa26-9b1104c0f13f`, key set                                           |
| Razorpay      | **Not configured.** Subscribe page shows "register interest" instead of checkout              |
| Google OAuth  | **Not configured.** Sign-in currently works by magic link only                                |

---

## Where each secret lives now

- **Vercel** — both projects, all environments. `NEXT_PUBLIC_*` as plain,
  everything else encrypted and write-only.
- **GitHub Actions secrets** — `CRON_SECRET` and `SITE_URL`, for the scheduler.
- **`apps/*/.env.local`** — local development only. Gitignored, and confirmed
  so before the first push.

Nothing is committed. The repository was scanned for secret patterns before each
push.

---

## Email will not reach anyone yet

`RESEND_FROM_EMAIL` is `onboarding@resend.dev`, which is Resend's shared testing
sender. It only delivers to the address that owns the Resend account. That is
deliberate — it keeps the app functional without a verified domain — but it
means newsletter confirmations and editorial notifications go nowhere useful
until the DNS records in `docs/dns.md` are added and the domain verifies.

After verification, set:

```bash
RESEND_FROM_EMAIL="BCM10 News <news@bcm10news.in>"
```
