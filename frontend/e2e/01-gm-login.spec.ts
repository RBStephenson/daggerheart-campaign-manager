import { expect, test } from '@playwright/test';

// Smoke test: confirms the E2E stack is wired up end to end — frontend,
// Vite proxy, backend, DB, and the bootstrapped GM account from
// docker-compose.e2e.yml. Later specs assume a logged-in GM session exists
// by this point in the run.
test('GM logs in and lands on the Gamemaster page', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(/\/gm$/);
  await expect(page.getByRole('heading', { name: 'Gamemaster' })).toBeVisible();
});

test('rejects an invalid login', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/\/login$/);
});
