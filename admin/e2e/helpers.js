export async function signIn(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin.demo@example.com');
  await page.getByLabel('Password').first().fill('demo-password');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL('/');
}

export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/images\.pexels|Failed to load resource/.test(m.text()))
      errors.push(m.text());
  });
  return errors;
}
