import { expect, test } from '@playwright/test';

// Smoke test for DHCM-79/80 (quick-generate assist): a GM creates a
// campaign, opens Quick Generate, and generates a name, an NPC sketch,
// and a loot suggestion, then confirms reroll and dismiss both work.
test('GM generates a name, NPC, and loot suggestion', async ({ page, request }) => {
  const campaignName = `E2E Generate Campaign ${Date.now()}`;

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: { campaigns_enabled: true, generators_enabled: true },
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
  await campaignCard.getByRole('button', { name: 'Quick generate' }).click();

  await campaignCard.getByRole('button', { name: 'Generate Name' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'Name' })).toBeVisible();

  await campaignCard.getByRole('button', { name: 'Generate NPC' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'NPC' })).toBeVisible();
  await expect(campaignCard.getByText(/Motivation:/)).toBeVisible();
  await expect(campaignCard.getByText(/Quirk:/)).toBeVisible();

  await campaignCard.getByRole('button', { name: 'Reroll' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'NPC' })).toBeVisible();

  await campaignCard.getByRole('button', { name: 'Generate Loot' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'Loot' })).toBeVisible();

  await campaignCard.getByRole('button', { name: 'Dismiss' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'Loot' })).not.toBeVisible();
});
