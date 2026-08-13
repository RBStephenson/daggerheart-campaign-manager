import { expect, test } from '@playwright/test';

// Smoke test for DHCM-79/80/81 (quick-generate assist): a GM creates a
// campaign, opens Quick Generate, generates a name/NPC/loot suggestion,
// confirms reroll and dismiss work, then keeps a generated NPC and
// confirms it actually lands in the Library, not just a UI success message.
test('GM generates suggestions and keeps an NPC to the Library', async ({ page, request }) => {
  const campaignName = `E2E Generate Campaign ${Date.now()}`;

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: { campaigns_enabled: true, generators_enabled: true, library_enabled: true },
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  // Ensure a Library world exists — reuse one from an earlier spec if the
  // shared DB already has one, otherwise create it, so this spec is
  // self-contained regardless of run order.
  await page.getByRole('link', { name: 'Library' }).click();
  const continentsButton = page.getByRole('button', { name: 'Continents' });
  const worldNameInput = page.getByPlaceholder('World name');
  await Promise.race([
    continentsButton.waitFor({ state: 'visible' }),
    worldNameInput.waitFor({ state: 'visible' }),
  ]);
  if (await worldNameInput.isVisible()) {
    await worldNameInput.fill('E2E Generate World');
    await page.getByRole('button', { name: 'Create world' }).click();
    await expect(continentsButton).toBeVisible();
  }

  await page.getByRole('link', { name: 'Campaigns' }).click();
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

  const npcName = await campaignCard.getByTestId('quick-generate-npc-name').innerText();

  await campaignCard.getByRole('button', { name: 'Keep' }).click();
  await expect(campaignCard.getByRole('button', { name: 'Added to Library' })).toBeVisible();

  // Confirm it actually landed in the Library, not just a local UI flag.
  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: /^NPCs$/ }).click();
  await expect(page.getByText(npcName)).toBeVisible();

  // Navigating away unmounts CampaignsPage, so the Quick Generate toggle
  // resets on return — reopen it before generating again.
  await page.getByRole('link', { name: 'Campaigns' }).click();
  await campaignCard.getByRole('button', { name: 'Quick generate' }).click();
  await campaignCard.getByRole('button', { name: 'Generate Loot' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'Loot' })).toBeVisible();
  await expect(campaignCard.getByRole('button', { name: 'Keep' })).not.toBeVisible();

  await campaignCard.getByRole('button', { name: 'Dismiss' }).click();
  await expect(campaignCard.getByRole('heading', { name: 'Loot' })).not.toBeVisible();
});
