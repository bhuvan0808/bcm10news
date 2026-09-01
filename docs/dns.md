# DNS: pointing bcm10news.in at the platform

The domain stays registered at **GoDaddy**. Only the nameservers change, and
after that every record is managed in Cloudflare.

Doing it the other way — leaving DNS at GoDaddy and adding records there — also
works, but you lose Cloudflare's CDN, WAF and rate limiting, and R2 cannot serve
`images.bcm10news.in` at all. The nameserver move is worth the twenty minutes.

---

## Step 1 — Add the domain to Cloudflare

1. Cloudflare dashboard → **Add a site** → `bcm10news.in` → **Free** plan.
2. Cloudflare scans the existing records. Check the list, then continue.
3. It shows two nameservers, something like:

   ```text
   xxxx.ns.cloudflare.com
   yyyy.ns.cloudflare.com
   ```

## Step 2 — Change the nameservers at GoDaddy

GoDaddy → **My Products** → `bcm10news.in` → **DNS** → **Nameservers** →
**Change** → **I'll use my own nameservers** → enter both Cloudflare
nameservers → **Save**.

Propagation is usually under an hour; GoDaddy quotes up to 48. Cloudflare emails
you when the zone goes active.

> Nothing else works until this is done. R2 custom domains and Vercel domain
> verification both require the zone to be live in Cloudflare.

## Step 3 — Records to create in Cloudflare

Once the zone is active, add these under **DNS → Records**.

### The sites

| Type  | Name    | Content                | Proxy        |
| ----- | ------- | ---------------------- | ------------ |
| CNAME | `@`     | `cname.vercel-dns.com` | **DNS only** |
| CNAME | `www`   | `cname.vercel-dns.com` | **DNS only** |
| CNAME | `admin` | `cname.vercel-dns.com` | **DNS only** |

**Set these to "DNS only" (grey cloud), not proxied.** Vercel terminates TLS and
runs its own CDN; proxying through Cloudflare on top causes certificate
provisioning to fail and adds a redundant hop. This is the one place where the
orange cloud is wrong.

Then in each Vercel project → **Settings → Domains**, add:

- project `bcm10news` → `bcm10news.in` and `www.bcm10news.in`
- project `bcm10news-admin` → `admin.bcm10news.in`

Vercel verifies via the CNAME and issues certificates automatically.

### Images (R2)

Do **not** create this record by hand. In the Cloudflare dashboard go to
**R2 → bcm10news → Settings → Custom Domains → Connect Domain** and enter
`images.bcm10news.in`. Cloudflare creates the record itself and wires the bucket
to its cache. This one _is_ proxied, which is the point — it is what puts images
behind the CDN instead of hitting the bucket on every request.

### Email (Resend)

`bcm10news.in` is already registered with Resend (domain id
`b3661947-7fe6-4e85-b3ed-0df48ce2c49c`). Add these three, all **DNS only**:

| Type | Name                | Content                                                                                                                                                                                                                      |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TXT  | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCbnrmPc3lqfVKOLIMPOgkpPtwSlXeE3dGbD2gxiri4pbtO33+Akmy3FMr7Ow2U9mR3Vj6XDSBCg1cjXgew64NAwtgVakklFwFlDuLYemrEuT0XACREh53WrDAqcUk16Beorw41BbZ3+elFezGpuFHi2qQMLuzUnloc7r4AwRCCzwIDAQAB` |
| MX   | `send`              | `feedback-smtp.ap-northeast-1.amazonses.com` (priority `10`)                                                                                                                                                                 |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                                                                                                                                                                                          |

Then press **Verify** in the Resend dashboard.

Also worth adding, once DKIM verifies — it tells receiving servers what to do
with mail that fails authentication, and materially improves inbox placement:

| Type | Name     | Content                                           |
| ---- | -------- | ------------------------------------------------- |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@bcm10news.in` |

Start at `p=none` (monitor only). Move to `p=quarantine` after a few weeks of
clean reports.

---

## Step 4 — Switch the app to the real domain

Until this point both apps run on `*.vercel.app`. Once the domains resolve,
update these environment variables in **both** Vercel projects and redeploy:

```bash
NEXT_PUBLIC_SITE_URL=https://bcm10news.in
NEXT_PUBLIC_ADMIN_URL=https://admin.bcm10news.in
NEXT_PUBLIC_MEDIA_URL=https://images.bcm10news.in
R2_PUBLIC_BASE_URL=https://images.bcm10news.in
RESEND_FROM_EMAIL="BCM10 News <news@bcm10news.in>"
```

`scripts/setup-vercel.mjs` will do it for both projects at once.

Two follow-ups that are easy to forget:

- **R2 CORS** currently allows `admin.bcm10news.in` and localhost. It already
  includes the real domain, so nothing to change — but if you add another
  origin later, update it or uploads will fail with an opaque CORS error.
- **Supabase Auth → URL Configuration**: add the real callback URLs, or
  sign-in will redirect to the Vercel domain after the domain switch.

---

## Step 5 — Cloudflare settings worth turning on

Once traffic is flowing:

- **SSL/TLS → Full (strict)**
- **Speed → Brotli** on
- **Caching → Tiered Cache** on — reduces requests back to R2
- **Security → WAF → Rate limiting rules**:

| Path              | Limit                                           |
| ----------------- | ----------------------------------------------- |
| `/api/newsletter` | 5 / 5 min / IP                                  |
| `/api/track/view` | 60 / min / IP                                   |
| `/api/webhooks/*` | 100 / min (Razorpay and Resend retry in bursts) |
| `/search`         | 30 / min / IP                                   |

The rate limiter inside the app is per-instance and cannot bound anything
globally; these rules are the real control.

---

## Checking it worked

```bash
dig +short bcm10news.in
dig +short admin.bcm10news.in
dig +short images.bcm10news.in
dig +short TXT resend._domainkey.bcm10news.in

curl -I https://bcm10news.in
curl -I https://admin.bcm10news.in     # expect a 307 to /sign-in
```
