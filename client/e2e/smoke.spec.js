import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/businesses',
  '/businesses?category=restaurants&location=Holetown',
  '/category/tours',
  '/business/sample-holetown-restaurant',
  '/business/turquoise-tide-catamaran',
  '/places/bathsheba',
  '/places/christ-church',
  '/discover',
  '/guides',
  '/guides/where-to-experience-local-bajan-food',
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/this-route-does-not-exist',
];

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

// Map tiles are third-party; don't fail the smoke test if a tile request is blocked offline.
const IGNORED = [/tile\.openstreetmap\.org/, /favicon/];

for (const route of ROUTES) {
  test(`loads ${route} without console errors or broken images`, async ({ page }) => {
    const errors = [];
    page.on(
      'console',
      (msg) =>
        msg.type() === 'error' &&
        !IGNORED.some((r) => r.test(msg.text())) &&
        errors.push(msg.text()),
    );
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    // Scroll through so lazy images load
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    // Force lazy images (e.g. in horizontal carousels) to load so every image is verified.
    await page.evaluate(() =>
      document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager')),
    );
    // Wait for every rendered image to finish (load or fail) — remote photos can be slow.
    // (Images inside display:none containers never lazy-load, so only rendered ones are checked.)
    await page.waitForFunction(
      () =>
        [...document.images].filter((img) => img.checkVisibility()).every((img) => img.complete),
      null,
      { timeout: 45_000 },
    );

    const broken = await page.evaluate(() =>
      [...document.images]
        .filter(
          (img) =>
            img.checkVisibility() &&
            img.complete &&
            img.naturalWidth === 0 &&
            !img.src.includes('tile.openstreetmap'),
        )
        .map((i) => i.src),
    );
    expect(broken, 'broken images').toEqual([]);
    expect(errors, 'console errors').toEqual([]);
  });
}

test('no horizontal overflow at representative widths', async ({ page }) => {
  test.slow();
  for (const route of [
    '/',
    '/businesses',
    '/business/sample-holetown-restaurant',
    '/places/holetown',
    '/guides/exploring-the-west-coast',
    '/contact',
  ]) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.locator('h1').first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} @ ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});
