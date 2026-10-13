import { expect, test } from '@playwright/test';
import { signIn, trackErrors } from './helpers';

const ROUTES = [
  '/',
  '/listings',
  '/listings/new',
  '/listings/submissions',
  '/listings/lst-001',
  '/listings/lst-001/edit',
  '/listings/lst-001/preview',
  '/categories',
  '/locations',
  '/knowledge',
  '/knowledge/new',
  '/knowledge/doc-001',
  '/knowledge/faqs',
  '/knowledge/sync',
  '/chatbot',
  '/chatbot/conversations',
  '/chatbot/conversations/conv-2318',
  '/chatbot/settings',
  '/advertising',
  '/advertising/featured',
  '/users',
  '/users/usr-01',
  '/administrators',
  '/feedback',
  '/activity',
  '/monitoring/health',
  '/monitoring/errors',
  '/settings/general',
  '/settings/appearance',
  '/settings/notifications',
  '/settings/account',
  '/nope',
];

test('every route renders without console errors', async ({ page }) => {
  test.slow();
  const errors = trackErrors(page);
  await signIn(page);
  for (const r of ROUTES) {
    await page.goto(r);
    await expect(page.locator('h1').first(), r).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('no horizontal overflow at supported widths', async ({ page }) => {
  test.slow();
  await signIn(page);
  for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const r of ROUTES) {
      await page.goto(r);
      await page.locator('h1').first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${r} @ ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});
