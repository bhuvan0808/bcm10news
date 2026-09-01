# The newsroom

How BCM10 works day to day, and what the software enforces.

---

## Roles

| Role                     | Can do                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| **Reporter**             | Create stories, edit their own drafts, upload media, submit for review   |
| **Photographer**         | Upload and manage media. Cannot publish articles                         |
| **Editor**               | Everything a reporter can, plus review, edit anyone's story, and publish |
| **Managing editor**      | As editor, across the whole newsroom                                     |
| **Super admin**          | Everything, including roles and settings                                 |
| **Subscription manager** | Subscriptions, plans, invoices, B2B licences                             |

A reporter can be granted `can_publish` individually — a senior correspondent filing at midnight
should not need to wake an editor. That grant is set by a super admin and is recorded in the audit
log.

**A reporter cannot publish without it.** That is enforced by a database trigger, not by hiding a
button.

---

## The path a story takes

```text
draft ──▶ submitted ──▶ in_review ──▶ approved ──▶ published
  ▲            │             │            │
  └────────────┴─────────────┘            └──▶ scheduled ──▶ published
        changes_requested
```

Every transition is checked against `is_legal_transition()` in Postgres. `draft → published` is
not in that list, so no code path can skip review.

Every transition writes a row to `article_status_history`, and every meaningful save writes an
immutable snapshot to `article_revisions`. Both are done by triggers, so the record cannot be
missing because someone used a different route.

---

## Filing a story

1. **Stories → Start a story.**
2. Headline and section are the only things needed to save. Everything else can follow.
3. The story autosaves a few seconds after you stop typing. The header shows when it last saved.
4. Add a lead image. **Write the alt text** — it is what a blind reader hears and what Google
   Images reads.
5. Paste a YouTube link anywhere in the body and it becomes a video block. Paste the normal link
   from the address bar; never an embed code.
6. **Submit for review.**

The slug follows the headline until you edit it by hand, after which it stops moving. That matters
once a story has been shared: changing a published URL breaks every link to it. If you do change
it, the old URL redirects automatically.

### On a phone

The CMS is built for it. Uploads go straight from the phone to storage, with a progress bar, so a
photo does not have to survive a round trip through the server on a district connection.

---

## Reviewing

**Review queue** shows three groups:

- **Waiting for a reviewer** — oldest first, deliberately. Newest-first quietly starves the story
  that has waited longest, and a reporter whose piece sits for two days stops filing early.
- **Being reviewed** — someone has picked these up.
- **Approved and ready** — cleared, waiting to publish.

For each story: **take it for review**, then **approve**, **request changes**, or **reject**.

Requesting changes needs a comment. This is enforced. A story returned with no explanation costs
the reporter a round trip and the desk an hour.

---

## Publishing

Approved stories can be published immediately or scheduled.

Publishing runs in this order:

1. The transition commits in Postgres.
2. The public site's caches for that story, its section, the homepage, the sitemap and the feeds
   are purged.
3. Notifications go out, if requested.

If a notification fails, the story is still published. A failed push must never roll back the news.

**Scheduled** lists everything queued, and flags anything past its publish time. If stories appear
overdue, the publish cron is not running — tell an administrator.

---

## Corrections and takedowns

- **Correcting a published story**: edit and save. The public page refreshes within a minute, and
  the previous version stays in the revision history.
- **Taking a story down**: an editor moves it back to draft. It disappears from the site and its
  cached copies are purged.

Nothing is ever hard-deleted. `article_revisions` and `audit_logs` keep the record.

---

## Media

The library holds everything uploaded. Anyone in the newsroom can see all of it; the public sees
only assets that have appeared on a published story.

Images without alt text are badged **No alt** in the grid. Fix them.

Credit matters: fill in the photographer or agency. It is a legal requirement for agency
photographs and a courtesy for everyone else.

---

## Paths worth testing before launch

These are the scenarios that must work, and the ones an E2E suite should cover:

1. Reporter files a story → submits → editor approves → publishes → it appears on the site within
   a minute.
2. A reporter without `can_publish` **cannot** publish, and is told to submit instead.
3. A reporter cannot open another reporter's draft.
4. A subscriber can read a premium story.
5. A signed-out reader gets the teaser and the paywall — and the body is not in the page source.
6. A Razorpay webhook activates a subscription; a failed payment does not.
7. A published story invalidates the homepage, its section and the sitemap.
8. A pasted YouTube link in every form (`watch?v=`, `youtu.be`, `shorts`) becomes a video.
9. An uploaded image creates a media row and appears on the article.
10. A scheduled story publishes itself when its time arrives.
