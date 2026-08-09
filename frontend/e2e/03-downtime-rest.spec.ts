import { expect, test, request as playwrightRequest } from '@playwright/test';

// Smoke test for DHCM-51 (downtime rest actions): a player takes a short
// rest to partially clear HP (a real dice roll against the live backend) and
// a long rest to fully clear Stress.
//
// Setup mirrors 02-character-sheet.spec.ts — API-driven campaign/invite/
// character creation, since that flow already has its own coverage. This
// spec's job is proving the rest endpoints work end to end through the UI.
test('player takes a short rest and a long rest', async ({ page, baseURL }) => {
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
      downtime_enabled: true,
    },
  });

  const campaignResp = await gmContext.post('/api/campaigns', {
    data: { name: 'E2E Downtime Campaign', description: '' },
  });
  const campaign = (await campaignResp.json()) as { id: number };

  const inviteResp = await gmContext.post('/api/auth/invites', { data: { role: 'player' } });
  const invite = (await inviteResp.json()) as { token: string };

  const playerContext = await playwrightRequest.newContext({ baseURL });
  const registerResp = await playerContext.post('/api/auth/register', {
    data: { token: invite.token, username: 'e2e-rest-player', password: 'e2e-player-password' },
  });
  expect(registerResp.ok()).toBe(true);

  await gmContext.post(`/api/campaigns/${campaign.id}/members`, {
    data: { username: 'e2e-rest-player' },
  });

  const characterResp = await playerContext.post('/api/player/characters', {
    data: {
      campaign_id: campaign.id,
      name: 'Restwell',
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

  // Mark HP and Stress to their max via the API so the rest results below
  // are deterministic to check (a short-rest roll always clears *something*
  // out of a full pool; a long rest always clears to zero).
  await playerContext.patch(`/api/player/characters/${character.id}/state`, {
    data: { hp_marked: 5, stress_marked: 6 },
  });

  await gmContext.dispose();
  await playerContext.dispose();

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-rest-player');
  await page.getByLabel('Password').fill('e2e-player-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/player$/);

  await expect(page.getByText('Restwell')).toBeVisible();
  await expect(page.getByText('5 / 5')).toBeVisible(); // HP
  await expect(page.getByText('6 / 6')).toBeVisible(); // Stress

  // Short Rest is the default selection — take Tend to Wounds and confirm a
  // real roll cleared some (but not necessarily all) HP.
  await page.getByRole('button', { name: 'Tend to Wounds' }).click();
  await expect(page.getByText(/Rolled \d \+ Tier 1 — cleared \d HP\./)).toBeVisible();
  await expect(page.getByText('5 / 5')).not.toBeVisible();

  // Switch to Long Rest and Clear Stress — a deterministic full clear.
  await page.getByRole('combobox', { name: 'Rest type' }).selectOption('long');
  await page.getByRole('button', { name: 'Clear Stress' }).click();
  await expect(page.getByText('Cleared all 6 marked Stress.')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();
});
