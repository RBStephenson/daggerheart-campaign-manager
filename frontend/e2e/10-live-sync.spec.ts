import { expect, test } from '@playwright/test';

// Smoke test for DHCM-60 (live WebSocket sync): two real browser contexts,
// one GM and one player, both viewing the same active session. Confirms a
// change made in one tab appears in the other WITHOUT a reload — the whole
// point of this ticket, since DHCM-58/59 already proved the plain
// (refresh-required) read views work.
test('GM and player see each other live-update during an active session', async ({ browser, request }) => {
  const campaignName = `E2E Live Sync Campaign ${Date.now()}`;
  const username = `e2e-live-player-${Date.now()}`;

  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: {
      campaigns_enabled: true,
      player_area_enabled: true,
      combat_tools_enabled: true,
      character_sheet_enabled: true,
      realtime_enabled: true,
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
      name: 'Livewire',
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

  // Start the session before either browser opens, so both find it active
  // as soon as they load.
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.post(`/api/campaigns/${campaign.id}/sessions`);

  const gmContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  await gmPage.goto('/login');
  await gmPage.getByLabel('Username').fill('e2e-gm');
  await gmPage.getByLabel('Password').fill('e2e-only-password');
  await gmPage.getByRole('button', { name: 'Log in' }).click();
  await expect(gmPage).toHaveURL(/\/gm$/);
  const campaignCard = gmPage.getByRole('listitem').filter({ hasText: campaignName });
  await campaignCard.getByRole('button', { name: 'Party' }).click();
  await expect(campaignCard.getByText('Livewire')).toBeVisible();

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.goto('/login');
  await playerPage.getByLabel('Username').fill(username);
  await playerPage.getByLabel('Password').fill('e2e-player-password');
  await playerPage.getByRole('button', { name: 'Log in' }).click();
  await expect(playerPage).toHaveURL(/\/player$/);
  await expect(playerPage.getByText('0 / 12')).toBeVisible();

  // GM adjusts Fear -> player's tab updates without a reload.
  await campaignCard.getByRole('group', { name: 'Fear pool' }).getByRole('button', { name: 'Gain a Fear' }).click();
  await expect(playerPage.getByText('1 / 12')).toBeVisible();

  // Player marks HP -> GM's Party panel updates without a reload.
  await playerPage.getByRole('button', { name: 'Mark a HP' }).click();
  await expect(campaignCard.getByText('1 / 5')).toBeVisible();

  await gmContext.close();
  await playerContext.close();
});
