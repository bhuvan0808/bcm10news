# Architecture

Why the system is built the way it is. Each section states the decision, the alternative that was
rejected, and what would change the answer.

---

## Authorization lives in Postgres

**Decision.** Row Level Security, triggers and CHECK constraints enforce the editorial and access
rules. The applications mirror them for UI purposes only.

**Rejected.** Enforcing in application code, with the database as storage.

**Why.** Three code paths already write articles — the CMS, the scheduled-publish cron, and the
payment webhook — and a fourth will exist within a year (an import script, a mobile app, a
partner API). Every one of them would need the same checks, and the day one of them forgets is
the day a reporter publishes without review or a non-subscriber reads a premium story.

Putting it in Postgres means a rule cannot be bypassed by taking a different route, including a
direct `psql` session.

**What would change it.** Nothing likely. If the schema were ever split across services, RLS
would need rethinking, but the constraint would still be enforced below the application.

---

## The paywall is a row that does not exist

**Decision.** A premium article's row is invisible to a reader without the `premium_content`
entitlement. The teaser comes from `article_previews`, a view exposing headline, image and
metadata but no body.

**Rejected.** Fetching the article and truncating it server-side; hiding the rest with CSS.

**Why.** Both alternatives put the full text somewhere it can be recovered — in the HTML payload,
in a JSON island, in a cached response. This design means the server never holds the body for an
unauthorised reader, so a rendering mistake cannot leak it.

It also keeps the article page honest about SEO: the story is declared paywalled in
`NewsArticle` structured data, which is what Google asks for and what stops the teaser being read
as cloaking.

**Cost.** A premium story costs one extra query for a signed-in reader, and cannot be served from
the shared cache for them. Free stories — the large majority — are unaffected.

---

## Article bodies are ProseMirror JSON, not HTML

**Decision.** Store a validated node tree. Render to React on the way out.

**Rejected.** Storing rendered HTML.

**Why.**

1. Stored HTML is stored trust. Anything that ever writes to that column — an import, a hand-run
   `UPDATE`, a compromised account — can inject markup into every reader's page. A tree of known
   node types cannot: an unrecognised node is dropped by the renderer.
2. Blocks stay addressable. A gallery is data, so the same document renders as a lazy facade on
   the web, a static thumbnail in an email digest, and plain text in the search vector.
3. Media references survive a move. Images store a `mediaId`, not a URL, so changing the media
   domain does not require rewriting every article.

**Cost.** A renderer must be maintained per output target. That is roughly 200 lines for the web.

---

## Two applications, one database

**Decision.** `apps/web` and `apps/admin` deploy separately and share `packages/*`.

**Rejected.** One app with routes under `/admin`.

**Why.** The two have opposite performance profiles. The public site is static, cached, minimal
JavaScript. The CMS is dynamic, per-user, and ships a rich-text editor. Combining them puts the
editor's bundle in the same build as the article page and makes it far easier for an admin-only
dependency to leak into the reader's bundle.

Separate deployments also mean the newsroom can be locked down at the network level —
`admin.bcm10news.in` can sit behind Cloudflare Access without touching the public site.

**Cost.** Cache invalidation crosses a network boundary, so the admin calls `/api/revalidate`
rather than `revalidateTag` directly. That is a documented, secret-authenticated call.

---

## The webhook is the authority on payment

**Decision.** Subscriptions and entitlements are written only by the Razorpay webhook handler,
after HMAC verification, keyed by the provider's event id for idempotency.

**Rejected.** Granting access on the browser's checkout callback.

**Why.** The browser callback is a claim by an untrusted party. It can be replayed, forged, or
simply never arrive because the reader closed the tab. The webhook is signed, retried by
Razorpay, and arrives regardless of what the browser did.

Entitlements are then derived from subscription state by a database trigger, so there is exactly
one place that decides what a plan grants — and a manual fix applied in SQL produces the same
result as a webhook.

---

## Caching by tag, invalidated on publish

**Decision.** Every cached read is tagged from a shared vocabulary. Publishing purges exactly the
tags that story touches.

**Rejected.** Time-based revalidation alone.

**Why.** A news site has two failure modes: a story that does not appear, and a homepage that
shows yesterday. Short timers everywhere fix the second by hammering the database. Tag
invalidation fixes both — the front page is static until something actually changes.

The timers remain as a safety net bounding how long a page can be wrong if an invalidation is
ever missed.

---

## Telugu is a first-class script, not a locale toggle

**Decision.** Slugs may contain Telugu. Search indexes both scripts. Every type role pairs a Latin
face with a Telugu one. Zero-width joiners are stripped from slugs.

**Why.** Telugu and English appear inside the same headline constantly, so treating one as the
"real" language and the other as a translation does not match how the newsroom writes.

The joiner detail is the kind of thing that only shows up in production: ZWNJ (U+200C) sits
_inside_ Telugu words to control ligature shaping and is invisible. Left in a slug, two URLs that
look identical to a human are different to a server. Turned into a hyphen — the naive fix — it
splits a word in half. It has to be removed, and `slugify()` does the same thing in TypeScript and
in SQL so the two never disagree.

**Known limit.** Postgres has no Telugu stemmer, so Telugu search is exact token matching via the
`simple` configuration. Adequate for now. A dedicated engine (Meilisearch, Typesense) becomes
worthwhile when the archive is large enough that morphological matching matters — and
`searchArticles()` is the single function that would need reimplementing.

---

## Vendors sit behind interfaces, and degrade to no-ops

**Decision.** `EmailService`, `PaymentService`, `NotificationService`, `MediaService`. Each falls
back to a no-op when its keys are absent.

**Why.** The platform has to be usable before every vendor account exists — KYC alone takes days.
A newsroom that cannot publish because OneSignal is not set up yet is a newsroom that will not
adopt the tool.

It also means a provider outage degrades rather than breaks: a failed push does not roll back a
publish.

**The exception.** `PaymentService` throws when unconfigured. A checkout that silently succeeds
and takes no money is worse than one that plainly refuses.

---

## Uploads go browser → R2 directly

**Decision.** The server signs a PUT bound to a specific content type and length, records a
ticket, and the browser uploads on its own. The server confirms the object exists before writing
the media row.

**Rejected.** Proxying uploads through a route handler.

**Why.** A 20 MB camera JPEG through a serverless function costs its memory and duration budget,
and on a district connection makes the reporter pay for the transfer twice. The ticket is what
keeps it safe: the storage key comes from the server's record, not the client, so a client cannot
claim a media row for an object it did not upload.

---

## Known gaps

Honest list, in rough priority order.

1. **Image variants are not pre-generated.** `media.variants` exists and the delivery code reads
   it, but nothing populates it. Delivery currently relies on `next/image`. A `sharp`-based
   post-upload job, or Cloudflare Image Resizing, would close this.
2. **`'unsafe-inline'` remains in the script CSP.** Next.js inlines its bootstrap; removing it
   needs nonce plumbing through middleware.
3. **Rate limiting is per-instance.** Real limiting belongs at the Cloudflare edge and is
   documented in `deployment.md`.
4. **No E2E tests yet.** The critical paths to cover are in `docs/newsroom.md`.
5. **B2B licensing has no admin UI.** Schema, quota consumption and usage ledger are complete;
   organisations must currently be created in SQL.
6. **Comments have no UI.** Table, moderation policy and counters exist.
