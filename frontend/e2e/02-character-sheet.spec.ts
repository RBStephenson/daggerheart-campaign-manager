import { expect, test, request as playwrightRequest } from '@playwright/test';

// Smoke test for DHCM-49 (character sheet mechanics): a player marks HP on
// a character with a completed sheet and sees it reflected immediately.
//
// Supporting state (campaign, invite, player account, membership, the
// character itself) is set up directly via the API rather than driven
// through the UI — the character-creation wizard and invite/registration
// flow are covered by their own unit tests; this spec's job is to prove the
// HP-marking feature works end to end against the real stack, not to
// re-walk every flow that produces the state it needs.
test('player marks HP on a character with a completed sheet', async ({ page, baseURL }) => {
  const gmContext = await playwrightRequest.newContext({ baseURL });
  await gmContext.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await gmContext.put('/api/settings', {
    data: {
      player_area_enabled: true,
      campaigns_enabled: true,
      character_creation_enabled: true,
      character_sheet_enabled: true,
    },
  });

  const campaignResp = await gmContext.post('/api/campaigns', {
    data: { name: 'E2E Campaign', description: '' },
  });
  const campaign = (await campaignResp.json()) as { id: number };

  const inviteResp = await gmContext.post('/api/auth/invites', { data: { role: 'player' } });
  const invite = (await inviteResp.json()) as { token: string };

  const playerContext = await playwrightRequest.newContext({ baseURL });
  const registerResp = await playerContext.post('/api/auth/register', {
    data: { token: invite.token, username: 'e2e-player', password: 'e2e-player-password' },
  });
  expect(registerResp.ok()).toBe(true);

  await gmContext.post(`/api/campaigns/${campaign.id}/members`, {
    data: { username: 'e2e-player' },
  });

  const characterResp = await playerContext.post('/api/player/characters', {
    data: {
      campaign_id: campaign.id,
      name: 'Testa',
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

  await gmContext.dispose();
  await playerContext.dispose();

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-player');
  await page.getByLabel('Password').fill('e2e-player-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/player$/);

  await expect(page.getByText('Testa')).toBeVisible();
  await expect(page.getByText('0 / 5')).toBeVisible();

  await page.getByRole('button', { name: 'Mark a HP' }).click();
  await expect(page.getByText('1 / 5')).toBeVisible();
});
