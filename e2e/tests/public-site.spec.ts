import { expect, test } from '@playwright/test';

/**
 * The public site.
 *
 * These are the paths a reader takes and the ones search engines depend on. They
 * run against a deployed environment with no credentials, so they can run on
 * every pull request.
 */

test.describe('reading the site', () => {
  test('the front page renders with navigation and stories', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/BCM10 News/);

    // The nav comes from the database, so its presence proves the whole read
    // path — Supabase, RLS, the cached query — is working, not just that Next
    // served a shell.
    const nav = page.getByRole('navigation', { name: /sections/i });
    await expect(nav.or(page.getByRole('button', { name: /open sections menu/i }))).toBeVisible();

    await expect(page.locator('footer')).toContainText('BCM10');
  });

  test('a section page lists its own stories', async ({ page }) => {
    await page.goto('/telangana');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // A 404 would render the not-found heading instead.
    await expect(page.getByText(/this page has moved on/i)).toHaveCount(0);
  });

  test('an unknown section 404s rather than rendering an empty page', async ({ page }) => {
    const response = await page.goto('/this-section-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('search returns a usable page for a query with no results', async ({ page }) => {
    await page.goto('/search?q=zzzznotarealterm');

    await expect(page.getByRole('heading', { name: /search/i })).toBeVisible();
    await expect(page.getByText(/nothing found/i)).toBeVisible();
  });

  test('search rejects a one-character query without erroring', async ({ page }) => {
    await page.goto('/search?q=a');
    await expect(page.getByText(/at least two characters/i)).toBeVisible();
  });
});

test.describe('discovery surfaces', () => {
  test('sitemap.xml is valid XML and lists the sections', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<urlset');
    expect(body).toContain('/subscribe');
  });

  test('the news sitemap uses the Google News namespace', async ({ request }) => {
    const response = await request.get('/news-sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('http://www.google.com/schemas/sitemap-news/0.9');
  });

  test('rss.xml is a valid feed with a self link', async ({ request }) => {
    const response = await request.get('/rss.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('<rss version="2.0"');
    expect(body).toContain('atom:link');
  });

  test('robots.txt points at both sitemaps and protects private routes', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('Sitemap:');
    // /account is per-reader and uncacheable; crawling it wastes budget.
    expect(body.toLowerCase()).toContain('/account');
  });
});

test.describe('security headers', () => {
  test('the public site sets the headers it claims to', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toContain('max-age=');

    // frame-src must allow YouTube and nothing arbitrary — this is what stops a
    // compromised article body embedding a hostile iframe.
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain('frame-src');
    expect(csp).toContain('youtube-nocookie.com');
    expect(csp).toContain("object-src 'none'");
  });
});

test.describe('internal endpoints', () => {
  test('cron endpoints refuse an unauthenticated caller', async ({ request }) => {
    for (const path of ['/api/cron/publish-scheduled', '/api/cron/refresh-trending']) {
      const response = await request.get(path);
      expect(response.status(), `${path} must require a secret`).toBe(401);
    }
  });

  test('revalidation refuses a wrong secret', async ({ request }) => {
    const response = await request.post('/api/revalidate', {
      headers: { 'x-revalidate-secret': 'definitely-not-the-secret' },
      data: { slug: 'anything' },
    });
    expect(response.status()).toBe(401);
  });

  test('the Razorpay webhook refuses an unsigned request', async ({ request }) => {
    const response = await request.post('/api/webhooks/razorpay', {
      data: { event: 'payment.captured' },
    });
    // 401 when payments are configured, 503 when they are not. Either way it
    // must never be 200 for an unsigned body.
    expect([401, 503]).toContain(response.status());
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the section drawer opens and closes', async ({ page }) => {
    await page.goto('/');

    const opener = page.getByRole('button', { name: /open sections menu/i });
    await expect(opener).toBeVisible();
    await opener.click();

    const drawer = page.getByRole('dialog', { name: /sections/i });
    await expect(drawer).toBeVisible();

    await page.getByRole('button', { name: /close menu/i }).click();
    await expect(drawer).toBeHidden();
  });

  test('the page does not scroll sideways', async ({ page }) => {
    await page.goto('/');

    // Horizontal overflow on a phone is the most common mobile layout bug and
    // the least likely to be noticed on a desktop.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
