import { expect, test } from '@playwright/test';

// Smoke test for DHCM-59 (player-facing Fear pool + countdown visibility):
// players previously had no visibility into either at all. Confirms a
// player sees the GM-set Fear value and an active countdown for their
// campaign.
test('player sees the campaign Fear pool and an active countdown', async ({ page, request }) => {
  const campaignName = `E2E Status Campaign ${Date.now()}`;
  const username = `e2e-status-player-${Date.now()}`;

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: { campaigns_enabled: true, player_area_enabled: true, combat_tools_enabled: true },
  });

  const campaignResp = await request.post('/api/campaigns', {
    data: { name: campaignName, description: '' },
  });
  const campaign = (await campaignResp.json()) as { id: number };

  await request.patch(`/api/campaigns/${campaign.id}/fear`, { data: { delta: 3 } });
  await request.post(`/api/campaigns/${campaign.id}/countdowns`, {
    data: { name: 'Ashen Cloud', starting_value: 4, loop: false },
  });

  const inviteResp = await request.post('/api/auth/invites', { data: { role: 'player' } });
  const invite = (await inviteResp.json()) as { token: string };
  const registerResp = await request.post('/api/auth/register', {
    data: { token: invite.token, username, password: 'e2e-player-password' },
  });
  expect(registerResp.ok()).toBe(true);

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.post(`/api/campaigns/${campaign.id}/members`, { data: { username } });

  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('e2e-player-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/player$/);

  const campaignCard = page.getByRole('listitem').filter({ hasText: campaignName });
  await expect(campaignCard.getByText('3 / 12')).toBeVisible();
  await expect(campaignCard.getByText('Ashen Cloud')).toBeVisible();
  await expect(campaignCard.getByText('4 / 4')).toBeVisible();
});
