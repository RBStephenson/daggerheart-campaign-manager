import { expect, test } from '@playwright/test';

// Smoke test for the in-app Help pages: the nav link appears once logged in
// and shows the role-appropriate guide (GM vs. Player).
test('GM sees the GM guide under Help', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  await page.getByRole('link', { name: 'Help' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
  await expect(page.getByText(/running a campaign/)).toBeVisible();
  await expect(page.getByRole('button', { name: /2\. Create a campaign/ })).toBeVisible();
});

test('player sees the Player guide under Help', async ({ page, request }) => {
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  const invite = await (
    await request.post('/api/auth/invites', { data: { role: 'player' } })
  ).json();

  await page.goto(`/register?token=${invite.token}`);
  await page.getByLabel('Username').fill(`e2e-help-player-${Date.now()}`);
  await page.getByLabel('Password').fill('e2e-player-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/player$/);

  await page.getByRole('link', { name: 'Help' }).click();
  await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
  await expect(page.getByText(/getting set up and playing/)).toBeVisible();
  await expect(page.getByRole('button', { name: /3\. Create a character/ })).toBeVisible();
});
