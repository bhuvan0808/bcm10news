import { expect, test } from '@playwright/test';

/**
 * The newsroom.
 *
 * The unauthenticated checks always run. The signed-in flow needs a real staff
 * account, so it is skipped unless E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are
 * set — that keeps the suite runnable on a pull request from a fork while still
 * covering the workflow when credentials are available.
 */
const ADMIN = process.env.E2E_ADMIN_URL ?? 'https://bcm10news-admin.vercel.app';
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('the newsroom is closed to the public', () => {
  test('every route redirects an anonymous visitor to sign-in', async ({ page }) => {
    for (const path of ['/', '/articles', '/people', '/analytics', '/media', '/review']) {
      const response = await page.goto(`${ADMIN}${path}`, { waitUntil: 'domcontentloaded' });

      // Either a redirect to sign-in, or the sign-in page served directly.
      expect(page.url(), `${path} must not be reachable`).toContain('/sign-in');
      expect(response?.status()).toBeLessThan(400);
    }
  });

  test('the sign-in page offers password, magic link and Google', async ({ page }) => {
    await page.goto(`${ADMIN}/sign-in`);

    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /email me a link/i })).toBeVisible();
  });

  test('a wrong password does not reveal whether the account exists', async ({ page }) => {
    await page.goto(`${ADMIN}/sign-in`);

    await page.getByLabel(/^email$/i).fill('definitely-not-a-user@example.invalid');
    await page.getByLabel(/^password$/i).fill('wrong-password-entirely');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Scoped to the form: Next.js injects its own role="alert" route announcer,
    // so an unscoped query matches two elements.
    const alert = page
      .locator('form')
      .getByRole('alert')
      .or(page.getByText(/do not match/i));
    await expect(alert.first()).toBeVisible();

    // The message must not distinguish "no such user" from "wrong password" —
    // that difference tells an attacker which addresses have accounts.
    await expect(alert.first()).toContainText(/do not match/i);
    await expect(alert.first()).not.toContainText(/not found|no user|does not exist/i);
  });

  test('the newsroom is never indexable', async ({ request }) => {
    const response = await request.get(`${ADMIN}/sign-in`);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['x-frame-options']).toBe('DENY');
  });
});

test.describe('signed in', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run these');

  test.beforeEach(async ({ page }) => {
    await page.goto(`${ADMIN}/sign-in`);
    await page.getByLabel(/^email$/i).fill(EMAIL!);
    await page.getByLabel(/^password$/i).fill(PASSWORD!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15_000 });
  });

  test('the dashboard shows the queues', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /good day/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /start a story/i }).first()).toBeVisible();
  });

  test('a story can be written, saved and submitted', async ({ page }) => {
    await page.goto(`${ADMIN}/articles/new`);

    const headline = `E2E probe ${Date.now()}`;
    await page.getByLabel(/^headline$/i).fill(headline);

    // Section is required before the story can move anywhere.
    const section = page.getByLabel(/^section$/i);
    await section.selectOption({ index: 1 });

    await page.getByRole('button', { name: /create story/i }).click();
    await page.waitForURL(/\/articles\/[0-9a-f-]{36}/, { timeout: 20_000 });

    // The slug is derived from the headline until someone edits it.
    await expect(page.getByLabel(/url slug/i)).toHaveValue(/e2e-probe-\d+/);

    await page.getByRole('button', { name: /submit for review/i }).click();
    await expect(page.getByText(/sent to the desk/i)).toBeVisible({ timeout: 15_000 });
  });

  test('analytics loads without traffic and says so plainly', async ({ page }) => {
    await page.goto(`${ADMIN}/analytics`);

    await expect(page.getByRole('heading', { name: /^analytics$/i })).toBeVisible();
    // Either real numbers or an honest empty state — never a crash.
    await expect(
      page.getByText(/no readership recorded yet/i).or(page.getByText(/page views/i))
    ).toBeVisible();
  });

  test('the people screen lists staff and offers to add someone', async ({ page }) => {
    await page.goto(`${ADMIN}/people`);

    await expect(page.getByRole('heading', { name: /^people$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add someone/i })).toBeVisible();
  });

  test('the add-person form explains what each role can do', async ({ page }) => {
    await page.goto(`${ADMIN}/people`);
    await page.getByRole('button', { name: /add someone/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/full name/i)).toBeVisible();
    await expect(dialog.getByLabel(/^role$/i)).toBeVisible();

    // Reporter is the default, and the extra-permissions block only appears for
    // it — publishing directly is the exception, not the norm.
    await expect(dialog.getByText(/cannot publish unless you grant it/i)).toBeVisible();
  });
});
