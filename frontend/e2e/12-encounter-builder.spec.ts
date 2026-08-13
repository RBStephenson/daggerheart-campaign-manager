import { expect, test } from '@playwright/test';

// Smoke test for DHCM-83/84 (encounter builder): a GM creates a campaign,
// opens the Encounter Builder, confirms the Battle Points budget reflects
// the real (empty) party and adjustment toggles, then adds an adversary
// from the bestiary and confirms the running cost and over-budget
// indicator both track it.
test('GM sees the Battle Points budget and adds an adversary', async ({ page, request }) => {
  const campaignName = `E2E Encounter Campaign ${Date.now()}`;

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
  await campaignCard.getByRole('button', { name: 'Encounter builder' }).click();

  // Empty party: base formula (3 x 0) + 2 = 2.
  await expect(campaignCard.getByText('Party of 0 — budget 2')).toBeVisible();

  await campaignCard.getByLabel(/Harder or longer fight/).check();
  await expect(campaignCard.getByText('Party of 0 — budget 4')).toBeVisible();

  // The SRD data stores adversary names in all-caps (matches its own
  // stat-block header style), so match case-insensitively.
  await campaignCard.getByPlaceholder('Search adversaries by name').fill('Acid Burrower');
  await expect(campaignCard.getByText(/Acid Burrower/i)).toBeVisible();
  await campaignCard.getByRole('button', { name: 'Add' }).click();

  // Acid Burrower is a Solo (5 Battle Points), which exceeds a budget of 4.
  await expect(campaignCard.getByText('5 / 4')).toBeVisible();
  await expect(campaignCard.getByText(/over budget/)).toBeVisible();

  await campaignCard.getByRole('button', { name: 'Remove' }).click();
  await expect(campaignCard.getByText('0 / 4')).toBeVisible();
  await expect(campaignCard.getByText('No adversaries added yet.')).toBeVisible();
});
