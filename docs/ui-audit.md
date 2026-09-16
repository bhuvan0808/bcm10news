# UI audit

## Running it

```bash
cd e2e
npx playwright test --config audit/audit.config.ts
```

It walks nine public pages plus the newsroom sign-in at 390px, 768px and
1440px, screenshots each to `e2e/audit/out/` (gitignored), runs axe-core
against WCAG 2.0/2.1 A and AA, and measures the things that are invisible in
source: horizontal overflow and what causes it, touch-target sizes, heading
hierarchy, and images with no `alt` attribute. It writes
`e2e/audit/out/report.md`.

It is a report, not a pass/fail gate. It is not in CI, because a finding here
usually needs a judgement rather than a revert.

## What the first run found

66 findings. Almost all of them were two bugs.

### Tailwind was not scanning the shared UI package

`h-8`, `h-10`, `h-12` and `text-[11px]` appear only in
`packages/ui/src/primitives.tsx`. Tailwind v4's automatic source detection
skips `node_modules`, and npm links workspace packages there, so those classes
were never generated — in either app.

A class that does not exist does not error. It does nothing. So every `Button`
in the public site and the newsroom had been rendering at its line-box height
since the day it was written: the `lg` primary button on the sign-in pages,
specified at 48px, was 24px tall. Every `Input` lost its height. Every `Badge`
lost its font size.

This is worth dwelling on, because nothing catches it. It type-checks. It
builds. It renders. Code review sees `h-12` in the source and believes it. The
only thing that catches it is measuring a real element in a real browser:

```
{"label":"Email me a link","size":"358x24","height":"24px","cls":"inline-flex …"}
```

The fix is one line per app:

```css
@source '../../../../packages/ui/src/**/*.{ts,tsx}';
```

**If you add another workspace package that emits class names, add an
`@source` line for it too, or the same thing will happen silently.**

### The palette had never been measured

Eleven tokens failed WCAG AA. Some were close; some were not:

| Token                        | Was       | Ratio | Now       | Ratio |
| ---------------------------- | --------- | ----- | --------- | ----- |
| web `ink-faint` (light)      | `#8a837b` | 3.62  | `#746e67` | 4.87  |
| web `ink-faint` (dark)       | `#78716a` | 3.89  | `#87817a` | 4.86  |
| web `live`                   | `#16a34a` | 3.19  | `#11803a` | 4.53  |
| newsroom `ink-faint` (light) | `#8b8b96` | 3.15  | `#6b6b74` | 4.93  |
| newsroom `ink-faint` (dark)  | `#71717a` | 3.84  | `#83838b` | 4.93  |
| `status-published` (light)   | `#16a34a` | 2.85  | `#117d39` | 4.88  |
| `status-archived` (light)    | `#a1a1aa` | 2.21  | `#6c6c72` | 4.87  |
| `status-changes` (light)     | `#ea580c` | 3.07  | `#bb460a` | 4.91  |
| `status-approved` (light)    | `#059669` | 3.25  | `#047c57` | 4.87  |
| `status-scheduled` (light)   | `#0891b2` | 3.18  | `#077691` | 4.89  |
| `status-draft` (both)        | `#71717a` | 3.51  | see below | 4.93  |

The workflow status colours matter most. A reporter scanning a queue reads the
dot before the word, and `archived` at 2.21:1 was illegible at the end of a
shift on a laptop screen. Each replacement is the darkest (or, in dark mode,
the lightest) point on the _same hue_ that clears 4.5:1, so the palette still
reads as the same eight colours.

Every value is recorded with its measured ratio in the two `globals.css`
files. **Re-measure before changing one** — several of the originals look
perfectly fine to the eye and are not.

### Red had to become two tokens

In dark mode `--color-brand` lightens to `#e8524f` so it stays legible as text
on a near-black page (5.12:1). But white on `#e8524f` is 3.65:1, so every
button, badge and ticker label that put white on the brand red failed.

One token cannot be both the ink and the background. So:

- `--color-brand` — the red used as **ink**: links, kickers, the masthead rule.
  Lightens in dark mode.
- `--color-brand-solid` — the red used as a **background** behind white text.
  `#c1272d` in both modes, 5.84:1 against white.
- `--color-brand-solid-hover` — darkens in light mode, lightens in dark, since
  darker-on-hover is invisible against a near-black page.

### Touch targets

The 44×44 figure is WCAG **AAA** (2.5.5). The actual AA bar is 24×24 (2.5.8,
WCAG 2.2). The first version of the audit reported both under one heading,
which made a comfortable 36px button look as broken as a 21px one. It now
separates them, and only the AA failures are treated as defects.

Fixed: header icon buttons (36–40px → 44px), the utility strip's links (21px —
the strip's padding now sits on the links rather than the strip), the
forgotten-password toggle (20px), the skip link (28px).

Still below 44px and deliberately so: the masthead wordmark at 32px, and the
`sm` button size at 32px. Both clear AA.

### Accessibility

The newsroom sign-in was the only page in either app with no `h1`. The
wordmark is now the heading.

## After

5 findings, three of which were the article page failing to render — see
below — and none of which were contrast.

## A caution about auditing a broken page

The first run reported "documents must have a `<title>`" against the article
page, and recorded contrast and touch-target findings for it. All of that was
measured against the error boundary: the page was returning HTTP 500, because
the Supabase project had been paused and its hostname no longer resolved.

axe will happily audit an error page and tell you about it in the vocabulary
of UI defects. The audit now checks the HTTP status first and says plainly
that the page did not render, marking its own findings for that page as
untrustworthy.
