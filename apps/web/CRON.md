# Scheduling

`vercel.json` declares both cron jobs at **daily** frequency. That is not the
intended cadence — it is the most a Vercel **Hobby** account allows, and a
deployment carrying a more frequent expression is rejected outright:

```
cron_jobs_limits_reached: Hobby accounts are limited to daily cron jobs.
```

Daily is useless for scheduled publishing: a story queued for 09:00 would go out
whenever the daily job happened to run. So the Vercel crons are a **backstop**,
and the real schedule comes from somewhere else.

## What the jobs need

| Endpoint | Wanted | Why |
| --- | --- | --- |
| `/api/cron/publish-scheduled` | every minute | A story scheduled for 09:00 should publish at 09:00, not 09:30 |
| `/api/cron/refresh-trending` | every 5 minutes | "Most read" going stale is survivable; being an hour stale is not |

Both are idempotent and safe to call as often as you like. `publish_due_articles()`
publishes in a single `UPDATE ... RETURNING`, so two overlapping calls cannot
publish the same story twice.

## Option 1 — Cloudflare Worker (recommended, free)

`infrastructure/cron-worker/` contains a Worker that calls both endpoints on a
one-minute trigger. Cloudflare's free tier permits per-minute cron, and the
account is already in use for DNS and R2.

```bash
cd infrastructure/cron-worker
npx wrangler secret put CRON_SECRET      # same value as the Vercel env var
npx wrangler deploy
```

## Option 2 — Vercel Pro

Upgrade the account and restore the original expressions in `vercel.json`:

```json
{ "path": "/api/cron/publish-scheduled", "schedule": "* * * * *" },
{ "path": "/api/cron/refresh-trending",  "schedule": "*/5 * * * *" }
```

Simplest, and one fewer moving part, at $20/month.

## Option 3 — any external pinger

The endpoints accept `Authorization: Bearer $CRON_SECRET`, so cron-job.org,
Upstash QStash or a GitHub Actions schedule all work. GitHub Actions is the
weakest of these: scheduled workflows on free runners are frequently delayed by
ten minutes or more, which defeats the purpose.

## Confirming it works

The newsroom's **Scheduled** page flags any story past its publish time. If
entries sit there marked overdue, the scheduler is not running.
