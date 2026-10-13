import { expect, test } from '@playwright/test';

test('hero search → directory → business detail', async ({ page, isMobile }) => {
  await page.goto('/');
  const form = page.getByRole('search', { name: 'Search the Barbados directory' });
  await form.getByLabel('Category').selectOption('restaurants');
  await form.getByLabel('Area').selectOption('Holetown');
  await form.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/businesses\?category=restaurants&location=Holetown/);
  await expect(page.getByText('2 businesses found')).toBeVisible();
  await page.getByRole('link', { name: 'Saltwind Beach Kitchen' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Saltwind Beach Kitchen' }),
  ).toBeVisible();
  await expect(page.getByText('Sponsored').first()).toBeVisible();
  if (!isMobile)
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Restaurants');
});

test('directory filters persist in the URL across refresh', async ({ page }) => {
  await page.goto('/businesses?q=snorkeling');
  await expect(page.getByText(/businesses? found/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search the directory' })).toHaveValue(
    'snorkeling',
  );
  await expect(page.getByRole('link', { name: 'Reef & Turtle Snorkel Co.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Atlantic Swell Surf School' })).toHaveCount(0);
});

test('chatbot answers a suggested question with relevant results', async ({ page }) => {
  await page.goto('/');
  // On phones the floating launcher waits until the hero is scrolled past; use the hero/header button.
  await page.getByRole('button', { name: 'Ask AI Bajan' }).first().click();
  const chat = page.getByRole('dialog', { name: 'AI Bajan' });
  await expect(chat).toBeVisible();
  await chat.getByRole('button', { name: 'Show guesthouses in Christ Church.' }).click();
  const results = chat.getByRole('list', { name: 'Directory results' });
  await expect(results).toBeVisible();
  await expect(results.getByRole('link')).toHaveCount(2);
  await expect(results).toContainText('Christ Church');
  await page.keyboard.press('Escape');
  await expect(chat).toBeHidden();
});

test('ask AI Bajan about a business adds context', async ({ page }) => {
  await page.goto('/business/sample-holetown-restaurant');
  await page.getByRole('button', { name: 'Ask AI Bajan about this business' }).click();
  const chat = page.getByRole('dialog', { name: 'AI Bajan' });
  await expect(chat.getByText('Asking about')).toBeVisible();
  await chat.getByRole('button', { name: 'What are the opening hours?' }).click();
  await expect(chat.getByText('Tuesday – Sunday: 12:00 pm – 10:00 pm')).toBeVisible();
});

test('mobile menu opens and navigates', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.getByRole('link', { name: 'Travel Guides' }).click();
  await expect(page).toHaveURL(/\/guides$/);
  await expect(menu).toBeHidden();
});

test('floating launcher appears after scrolling past the hero on phones', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/');
  const launcher = page.getByRole('button', { name: 'Open the AI Bajan travel assistant' });
  await expect(launcher).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
  await expect(launcher).toBeVisible();
});
