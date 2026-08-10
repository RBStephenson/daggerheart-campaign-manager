import { expect, test } from '@playwright/test';

// Smoke test for DHCM-55 (countdown tracker): a GM creates a campaign,
// creates a loop countdown, advances it to trigger, and confirms it resets
// to its starting value instead of sticking at 0.
test('GM creates and advances a looping countdown', async ({ page, request }) => {
  // Unique per run, same rationale as 04-fear-pool.spec.ts.
  const campaignName = `E2E Countdown Campaign ${Date.now()}`;

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: { campaigns_enabled: true, combat_tools_enabled: true },
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  await page.getByPlaceholder('Campaign name').fill(campaignName);
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await expect(page.getByText(campaignName)).toBeVisible();

  const campaignCard = page.getByRole('listitem').filter({ hasText: campaignName });
  await campaignCard.getByRole('button', { name: 'Countdowns' }).click();

  await page.getByPlaceholder('Countdown name').fill('Volley of Arrows');
  await page.getByPlaceholder('Starting value').fill('2');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create countdown' }).click();

  const row = campaignCard.getByRole('listitem').filter({ hasText: 'Volley of Arrows' });
  await expect(row).toBeVisible();
  await expect(row.getByText('2 / 2')).toBeVisible();
  await expect(row.getByText('(loop)')).toBeVisible();

  await row.getByRole('button', { name: 'Advance Volley of Arrows' }).click();
  await expect(row.getByText('1 / 2')).toBeVisible();

  // Second advance triggers it — a loop countdown resets to starting value
  // instead of sticking at 0.
  await row.getByRole('button', { name: 'Advance Volley of Arrows' }).click();
  await expect(row.getByText('2 / 2')).toBeVisible();
  await expect(row.getByText('Triggered!')).toBeVisible();

  // A page reload proves the reset round-tripped through the backend.
  await page.reload();
  await campaignCard.getByRole('button', { name: 'Countdowns' }).click();
  await expect(row.getByText('2 / 2')).toBeVisible();

  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(campaignCard.getByText('No countdowns yet.')).toBeVisible();
});
