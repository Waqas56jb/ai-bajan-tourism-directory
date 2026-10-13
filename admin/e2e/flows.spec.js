import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('protected routes redirect to login, then back', async ({ page }) => {
  await page.goto('/knowledge');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill('admin.demo@example.com');
  await page.getByLabel('Password').first().fill('demo-password');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
});

test('approve a submission and see it published', async ({ page }) => {
  await signIn(page);
  await page.goto('/listings/submissions');
  const row = page.getByRole('row', { name: /Harbourside Kitchen/ });
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Approved and published/)).toBeVisible();
  await page.goto('/listings?q=harbourside');
  await expect(page.getByRole('row', { name: /Harbourside Kitchen/ })).toContainText('Published');
});

test('edits persist across a reload and unsaved changes are guarded', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop flow');
  await signIn(page);
  await page.goto('/listings/lst-002/edit');
  await page.getByLabel(/short description/i).fill('Updated by the end-to-end test.');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Categories' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: 'Save and publish' }).click();
  await expect(page).toHaveURL(/\/listings\/lst-002$/);
  await page.reload();
  await expect(page.getByText('Updated by the end-to-end test.')).toBeVisible();
});

test('global search is keyboard accessible', async ({ page, isMobile }) => {
  test.skip(isMobile, 'shortcut is desktop-only');
  await signIn(page);
  const box = page.getByRole('combobox', { name: /search the admin/i });
  await expect(box).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(box).toBeFocused();
  await page.keyboard.type('pelican');
  await expect(page.getByRole('option', { name: /Pelican Craft Collective/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/listings\/lst-004$/);
});

test('mobile drawer navigation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await signIn(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Feedback' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Feedback & reports' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
});

test('reset demo data restores the original listings', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop flow');
  await signIn(page);
  await page.goto('/listings?q=saltwind');
  await page.getByRole('button', { name: 'Actions for Saltwind Beach Kitchen' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Listing deleted')).toBeVisible();
  await page.goto('/settings/general');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click();
  await expect(page.getByText('Demo data restored')).toBeVisible();
  await page.goto('/listings?q=saltwind');
  await expect(page.getByRole('link', { name: 'Saltwind Beach Kitchen' })).toBeVisible();
});
