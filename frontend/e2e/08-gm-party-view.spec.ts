import { expect, test } from '@playwright/test';

// Smoke test for DHCM-58 (GM party view): the GM previously had zero
// visibility into player characters. This confirms a player's character and
// its live HP/Stress/Hope actually show up in the GM's Party panel.
test('GM sees a player character and its live stats in the Party panel', async ({ page, request }) => {
  const campaignName = `E2E Party Campaign ${Date.now()}`;
  const username = `e2e-party-player-${Date.now()}`;

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: {
      campaigns_enabled: true,
      player_area_enabled: true,
      character_sheet_enabled: true,
    },
  });

  const campaignResp = await request.post('/api/campaigns', {
    data: { name: campaignName, description: '' },
  });
  const campaign = (await campaignResp.json()) as { id: number };

  const inviteResp = await request.post('/api/auth/invites', { data: { role: 'player' } });
  const invite = (await inviteResp.json()) as { token: string };
  const registerResp = await request.post('/api/auth/register', {
    data: { token: invite.token, username, password: 'e2e-player-password' },
  });
  expect(registerResp.ok()).toBe(true);

  // The register call above switched the shared request context's session
  // to the player; log back in as GM before using it again.
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.post(`/api/campaigns/${campaign.id}/members`, { data: { username } });

  await request.post('/api/auth/login', {
    data: { username, password: 'e2e-player-password' },
  });
  const characterResp = await request.post('/api/player/characters', {
    data: {
      campaign_id: campaign.id,
      name: 'Partytest',
      char_class: 'Bard',
      ancestry: 'Human',
      community: 'Wanderborne',
      level: 1,
      extra: JSON.stringify({
        char_class: 'Bard',
        subclass: 'Troubadour',
        heritage: { ancestry: 'Human', community: 'Wanderborne' },
        traits: { Agility: 2, Strength: 1, Finesse: 1, Instinct: 0, Presence: 0, Knowledge: -1 },
        evasion: 10,
        hp_max: 5,
        stress_max: 6,
        hope: 2,
        proficiency: 1,
        level: 1,
        experiences: [
          { name: 'Storyteller', modifier: 2 },
          { name: 'Charming', modifier: 2 },
        ],
        domain_cards: [
          { domain: 'Grace', name: 'Enrapture' },
          { domain: 'Codex', name: 'Book of Ava' },
        ],
        equipment: { primary_weapon: 'Rapier', secondary_weapon: 'Dagger', armor: 'Leather Armor' },
        inventory: [],
      }),
    },
  });
  expect(characterResp.ok()).toBe(true);
  const character = (await characterResp.json()) as { id: number };
  await request.patch(`/api/player/characters/${character.id}/state`, {
    data: { hp_marked: 2 },
  });

  // Back to GM for the UI check.
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  const campaignCard = page.getByRole('listitem').filter({ hasText: campaignName });
  await campaignCard.getByRole('button', { name: 'Party' }).click();

  await expect(campaignCard.getByText('Partytest')).toBeVisible();
  await expect(campaignCard.getByText(username)).toBeVisible();
  await expect(campaignCard.getByText('2 / 5')).toBeVisible();
});
