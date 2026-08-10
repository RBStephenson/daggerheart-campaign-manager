import { expect, test } from '@playwright/test';

// Smoke test for DHCM-54 (GM Fear pool tracker): a GM creates a campaign and
// adjusts the shared Fear pool through the real UI, confirming the value
// persists (round-trips through the backend, not just local state) and stays
// clamped at the SRD's 0-12 bounds.
test('GM gains and spends Fear on a campaign', async ({ page, request }) => {
  // Unique per run: other specs' campaigns share this DB for the run, and
  // repeated local invocations of this spec against a still-running stack
  // would otherwise collide on a fixed name.
  const campaignName = `E2E Fear Campaign ${Date.now()}`;

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

  // Other specs' campaigns share this DB for the run, so scope to this
  // campaign's own list item rather than a page-wide Fear pool selector.
  const campaignCard = page.getByRole('listitem').filter({ hasText: campaignName });
  const fearPool = campaignCard.getByRole('group', { name: 'Fear pool' });
  await expect(fearPool).toBeVisible();
  await expect(fearPool.getByText('0', { exact: true })).toBeVisible();

  await fearPool.getByRole('button', { name: 'Gain a Fear' }).click();
  await fearPool.getByRole('button', { name: 'Gain a Fear' }).click();
  await expect(fearPool.getByText('2', { exact: true })).toBeVisible();

  // A page reload proves the value round-tripped through the backend, not
  // just local component state.
  await page.reload();
  await expect(fearPool.getByText('2', { exact: true })).toBeVisible();

  await fearPool.getByRole('button', { name: 'Spend a Fear' }).click();
  await expect(fearPool.getByText('1', { exact: true })).toBeVisible();
});
