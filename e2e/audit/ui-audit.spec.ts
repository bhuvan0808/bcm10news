import AxeBuilder from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * UI audit.
 *
 * Not a pass/fail suite — a report. It walks every page at three widths,
 * screenshots each, runs axe, and measures the things that actually go wrong
 * in practice and are invisible when you only read source: horizontal
 * overflow, touch targets under 44px, heading hierarchy, and images with no
 * alt text.
 *
 * Run: npx playwright test --config audit/audit.config.ts
 */

const OUT = join(process.cwd(), 'audit', 'out');

const SITE = process.env.E2E_SITE_URL ?? 'https://bcm10news.vercel.app';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'https://bcm10news-admin.vercel.app';

const PUBLIC_PAGES = [
  ['home', '/'],
  ['section', '/telangana'],
  ['article', '/news/bcm10-platform-goes-live'],
  ['search', '/search?q=news'],
  ['subscribe', '/subscribe'],
  ['account', '/account'],
  ['about', '/about'],
  ['videos', '/videos'],
  ['not-found', '/no-such-page-at-all'],
] as const;

const WIDTHS = [
  ['mobile', 390, 844],
  ['tablet', 768, 1024],
  ['desktop', 1440, 900],
] as const;

interface Finding {
  page: string;
  width: string;
  kind: string;
  detail: string;
}

const findings: Finding[] = [];

/** Distinct failing colour pairs, keyed so one bad token reports once. */
const contrastPairs = new Map<string, Record<string, unknown>>();

/** Distinct undersized controls, keyed by width and label. */
const smallTargets = new Map<string, string>();

/** Measures the layout problems that only show up in a real browser. */
async function measure(page: Page, name: string, width: string) {
  const report = await page.evaluate(() => {
    const doc = document.documentElement;

    // Horizontal overflow, plus which element causes it — the useful half.
    const overflow = doc.scrollWidth - doc.clientWidth;
    const culprits: string[] = [];
    if (overflow > 1) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const rect = el.getBoundingClientRect();
        if (rect.right > doc.clientWidth + 1 && rect.width > 0) {
          const id = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : ''}`;
          if (!culprits.includes(id)) culprits.push(id);
          if (culprits.length >= 4) break;
        }
      }
    }

    // Interactive targets, split by which guideline they miss. 24×24 is
    // WCAG 2.2 AA (2.5.8) and is a defect; 44×44 is AAA (2.5.5) and is a
    // judgement call. Reporting both under one heading made a comfortable
    // 36px button look as broken as a 21px one, so they are kept apart.
    const small: string[] = [];
    const tight: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('a, button, input[type=checkbox], select')
    )) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Links inside a paragraph are exempt; the guideline is about controls.
      if (el.tagName === 'A' && el.closest('p, li, figcaption')) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName)
        .trim()
        .slice(0, 34);
      const size = `${label} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
      if (rect.height < 24 || rect.width < 24) small.push(size);
      else if (rect.height < 44) tight.push(size);
    }

    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
      level: Number(h.tagName[1]),
      text: (h.textContent ?? '').trim().slice(0, 50),
    }));

    const imagesWithoutAlt = Array.from(document.querySelectorAll('img')).filter(
      (img) => !img.hasAttribute('alt')
    ).length;

    return {
      overflow,
      culprits,
      small: small.slice(0, 8),
      tight: tight.slice(0, 8),
      headings,
      imagesWithoutAlt,
    };
  });

  if (report.overflow > 1) {
    findings.push({
      page: name,
      width,
      kind: 'horizontal-overflow',
      detail: `${report.overflow}px — ${report.culprits.join(', ')}`,
    });
  }

  if (report.small.length) {
    findings.push({
      page: name,
      width,
      kind: 'touch-target-below-aa',
      detail: report.small.join(' · '),
    });
    // The header repeats on every page, so the raw list is the same handful of
    // controls thirty times over. Collapse to the distinct ones to fix.
    for (const target of report.small) smallTargets.set(`AA   ${width} · ${target}`, width);
  }

  if (report.tight.length) {
    for (const target of report.tight) smallTargets.set(`AAA  ${width} · ${target}`, width);
  }

  if (report.imagesWithoutAlt > 0) {
    findings.push({
      page: name,
      width,
      kind: 'img-missing-alt-attribute',
      detail: `${report.imagesWithoutAlt} image(s)`,
    });
  }

  const h1s = report.headings.filter((h) => h.level === 1);
  if (h1s.length !== 1) {
    findings.push({
      page: name,
      width,
      kind: 'heading-h1-count',
      detail: `${h1s.length} h1 elements`,
    });
  }

  // A jump from h2 to h4 breaks the outline a screen reader navigates by.
  let previous = 0;
  for (const heading of report.headings) {
    if (previous && heading.level > previous + 1) {
      findings.push({
        page: name,
        width,
        kind: 'heading-level-skip',
        detail: `h${previous} → h${heading.level} at "${heading.text}"`,
      });
      break;
    }
    previous = heading.level;
  }
}

async function auditPage(page: Page, name: string, url: string, width: string) {
  const response = await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));

  // A 500 renders the error boundary, which has no <title>, one h1 and none of
  // the real page's markup — so axe dutifully reports findings about a page
  // nobody will ever see. That happened here and cost real time. Say plainly
  // that the page is broken, and do not dress the consequences up as UI
  // defects. /not-found is expected to be a 404 and is the one exception.
  const status = response?.status() ?? 0;
  const expected = name === 'not-found' ? 404 : 200;
  if (status !== expected) {
    findings.push({
      page: name,
      width,
      kind: 'page-did-not-render',
      detail: `HTTP ${status} (expected ${expected}) — findings below are from the error page, not the real one`,
    });
  }

  await page.screenshot({
    path: join(OUT, `${name}-${width}.png`),
    fullPage: true,
  });

  await measure(page, name, width);

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  for (const violation of axe.violations) {
    findings.push({
      page: name,
      width,
      kind: `axe:${violation.id}`,
      detail: `${violation.impact ?? 'n/a'} — ${violation.help} (${violation.nodes.length} node(s)) e.g. ${violation.nodes[0]?.target.join(' ')}`,
    });

    // Contrast is the one rule where the summary alone is useless: the fix
    // needs the two colours and the ratio, and axe already measured them.
    // Recorded once per distinct colour pair, since one bad token shows up on
    // every page and would otherwise bury the report.
    if (violation.id === 'color-contrast') {
      for (const node of violation.nodes) {
        const data = node.any[0]?.data as
          | { fgColor?: string; bgColor?: string; contrastRatio?: number; fontSize?: string }
          | undefined;
        if (!data?.fgColor) continue;
        const key = `${data.fgColor} on ${data.bgColor} @ ${data.fontSize}`;
        if (contrastPairs.has(key)) continue;
        contrastPairs.set(key, {
          ...data,
          example: node.target.join(' '),
          html: (node.html ?? '').slice(0, 110),
        });
      }
    }
  }
}

test.describe.configure({ mode: 'serial' });

for (const [widthName, w, h] of WIDTHS) {
  test.describe(`${widthName} (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`public site at ${widthName}`, async ({ page }) => {
      await mkdir(OUT, { recursive: true });
      for (const [name, path] of PUBLIC_PAGES) {
        await auditPage(page, name, `${SITE}${path}`, widthName);
      }
    });

    test(`newsroom sign-in at ${widthName}`, async ({ page }) => {
      await auditPage(page, 'newsroom-signin', `${ADMIN}/sign-in`, widthName);
    });
  });
}

test.afterAll(async () => {
  const byKind = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = byKind.get(finding.kind) ?? [];
    list.push(finding);
    byKind.set(finding.kind, list);
  }

  const lines = ['# UI audit', '', `${findings.length} findings.`, ''];

  for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`## ${kind} — ${list.length}`, '');
    for (const finding of list.slice(0, 12)) {
      lines.push(`- **${finding.page}** @ ${finding.width}: ${finding.detail}`);
    }
    if (list.length > 12) lines.push(`- …and ${list.length - 12} more`);
    lines.push('');
  }

  if (contrastPairs.size) {
    lines.push('## Distinct failing colour pairs', '');
    for (const [key, data] of contrastPairs) {
      lines.push(`- ${key} — ratio ${data['contrastRatio']} · \`${data['example']}\``);
    }
    lines.push('');
  }

  if (smallTargets.size) {
    lines.push('## Distinct undersized controls', '');
    for (const key of smallTargets.keys()) lines.push(`- ${key}`);
    lines.push('');
  }

  await writeFile(join(OUT, 'report.md'), lines.join('\n'), 'utf8');
  console.log('\n' + lines.join('\n'));
});
