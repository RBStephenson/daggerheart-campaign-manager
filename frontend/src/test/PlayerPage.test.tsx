import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as playerApi from '../api/player';
import * as srdApi from '../api/srd';
import PlayerPage from '../pages/player/PlayerPage';

vi.mock('../api/player');
vi.mock('../api/srd');
const mocked = vi.mocked(playerApi);
const mockedSrd = vi.mocked(srdApi.getCharacterCreationData);

const campaign = {
  id: 1,
  name: 'Windmere',
  description: '',
  gm_user_id: 1,
  created_at: '2026-01-01T00:00:00Z',
};

const character = {
  id: 1,
  player_user_id: 1,
  campaign_id: 1,
  name: 'Kael',
  char_class: 'Warrior',
  ancestry: 'Human',
  community: 'Highborne',
  level: 1,
  extra: '{}',
  hp_marked: 0,
  stress_marked: 0,
  hope: 2,
  armor_slots_marked: 0,
  created_at: '2026-01-01T00:00:00Z',
};

const sheetedCharacter = {
  ...character,
  id: 2,
  extra: JSON.stringify({
    hp_max: 6,
    stress_max: 6,
    equipment: { primary_weapon: 'Broadsword', armor: 'Leather Armor' },
  }),
};

const srdWithArmor = {
  version: 'test',
  traits: [],
  trait_array: [],
  starting: { level: 1, stress: 6, hope: 2, proficiency: 1 },
  classes: [],
  ancestries: [],
  communities: [],
  domains: [],
  domain_cards: [],
  primary_weapons: [],
  secondary_weapons: [],
  armor: [{ tier: 1, name: 'Leather Armor', base_thresholds: [6, 13] as [number, number], base_score: 3, feature: null }],
  combat_wheelchair: [],
  beastform_options: [],
  loot: [],
  consumables: [],
};

describe('PlayerPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: character creation and downtime flags off (their probes
    // 404), matching the real backend's 404-when-disabled gate.
    mockedSrd.mockRejectedValue(new ApiError(404, 'not found'));
    mocked.checkDowntimeAvailable.mockRejectedValue(new ApiError(404, 'not found'));
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.listMyCampaigns.mockRejectedValue(new ApiError(404, 'not found'));
    mocked.listMyCharacters.mockResolvedValue([]);
    render(<PlayerPage />);
    await waitFor(() =>
      expect(screen.getByText(/player area is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('shows empty states with no campaigns or characters', async () => {
    mocked.listMyCampaigns.mockResolvedValue([]);
    mocked.listMyCharacters.mockResolvedValue([]);
    render(<PlayerPage />);
    await waitFor(() =>
      expect(screen.getByText(/haven't been added to a campaign/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('No characters yet.')).toBeInTheDocument();
  });

  it('lists campaigns and characters', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([character]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });

    render(<PlayerPage />);
    await waitFor(() => expect(screen.getAllByText('Windmere').length).toBeGreaterThan(0));
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.getByText(/Warrior.*Human.*Highborne/)).toBeInTheDocument();
  });

  it('creates a character via the form', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.createCharacter.mockResolvedValue(character);

    render(<PlayerPage />);
    await waitFor(() => expect(screen.getByText('No characters yet.')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Character name'), 'Kael');
    await userEvent.click(screen.getByRole('button', { name: 'Create character' }));

    await waitFor(() =>
      expect(mocked.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: 1, name: 'Kael' }),
      ),
    );
  });

  it('deletes a character', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([character]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.deleteCharacter.mockResolvedValue(undefined);

    render(<PlayerPage />);
    await waitFor(() => expect(screen.getByText('Kael')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocked.deleteCharacter).toHaveBeenCalledWith(1));
  });

  it('loads and saves a note', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([]);
    mocked.getNote.mockResolvedValue({
      campaign_id: 1,
      body: 'existing note',
      updated_at: '2026-01-01T00:00:00Z',
    });
    mocked.saveNote.mockResolvedValue({
      campaign_id: 1,
      body: 'updated note',
      updated_at: '2026-01-01T00:01:00Z',
    });

    render(<PlayerPage />);
    const textarea = await screen.findByDisplayValue('existing note');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'updated note');

    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(mocked.saveNote).toHaveBeenCalledWith(1, 'updated note'));
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
  });

  it('shows the flat form when character creation is unavailable (SRD endpoint 404s)', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });

    render(<PlayerPage />);
    await screen.findByPlaceholderText('Character name');
    expect(
      screen.queryByRole('button', { name: 'Create Character (Guided)' }),
    ).not.toBeInTheDocument();
  });

  it('shows the guided wizard entry point when character creation is available', async () => {
    mockedSrd.mockResolvedValue({
      version: 'test',
      traits: [],
      trait_array: [],
      starting: { level: 1, stress: 6, hope: 2, proficiency: 1 },
      classes: [],
      ancestries: [],
      communities: [],
      domains: [],
      domain_cards: [],
      primary_weapons: [],
      secondary_weapons: [],
      armor: [],
      combat_wheelchair: [],
      beastform_options: [],
      loot: [],
      consumables: [],
    });
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });

    render(<PlayerPage />);
    await screen.findByRole('button', { name: 'Create Character (Guided)' });
    expect(screen.queryByPlaceholderText('Character name')).not.toBeInTheDocument();
  });

  it('marks HP on a sheeted character when character sheet tracking is enabled', async () => {
    mockedSrd.mockResolvedValue(srdWithArmor);
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([sheetedCharacter]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.updateCharacterState.mockResolvedValue({ ...sheetedCharacter, hp_marked: 1 });

    render(<PlayerPage />);
    await screen.findByText('Kael');

    // The probe call (empty body) resolving is what reveals the tracker UI.
    await waitFor(() => expect(mocked.updateCharacterState).toHaveBeenCalledWith(2, {}));
    const markHp = await screen.findByRole('button', { name: 'Mark a HP' });
    await userEvent.click(markHp);

    await waitFor(() =>
      expect(mocked.updateCharacterState).toHaveBeenCalledWith(2, { hp_marked: 1 }),
    );
    expect(await screen.findByText('1 / 6')).toBeInTheDocument();
  });

  it('hides the tracker UI when character sheet tracking is disabled (state PATCH 404s)', async () => {
    mockedSrd.mockResolvedValue(srdWithArmor);
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([sheetedCharacter]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.updateCharacterState.mockRejectedValue(new ApiError(404, 'not found'));

    render(<PlayerPage />);
    await screen.findByText('Kael');
    await waitFor(() => expect(mocked.updateCharacterState).toHaveBeenCalledWith(2, {}));
    expect(screen.queryByRole('button', { name: 'Mark a HP' })).not.toBeInTheDocument();
  });

  it('shows rest controls and applies a move when downtime is enabled', async () => {
    mockedSrd.mockResolvedValue(srdWithArmor);
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([sheetedCharacter]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.updateCharacterState.mockResolvedValue(sheetedCharacter);
    mocked.checkDowntimeAvailable.mockResolvedValue({ available: true });
    mocked.restCharacter.mockResolvedValue({
      character: { ...sheetedCharacter, hp_marked: 2 },
      result: { field: 'hp_marked', roll: 2, tier: 1, amount: 3, new_value: 2 },
    });

    render(<PlayerPage />);
    await screen.findByText('Kael');

    const tendWounds = await screen.findByRole('button', { name: 'Tend to Wounds' });
    await userEvent.click(tendWounds);

    await waitFor(() =>
      expect(mocked.restCharacter).toHaveBeenCalledWith(2, 'short', 'tend_wounds'),
    );
    expect(await screen.findByText(/Rolled 2 \+ Tier 1/)).toBeInTheDocument();
  });

  it('hides rest controls when downtime is disabled (availability probe 404s)', async () => {
    mockedSrd.mockResolvedValue(srdWithArmor);
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([sheetedCharacter]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.updateCharacterState.mockResolvedValue(sheetedCharacter);

    render(<PlayerPage />);
    await screen.findByText('Kael');
    await waitFor(() => expect(mocked.checkDowntimeAvailable).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Tend to Wounds' })).not.toBeInTheDocument();
  });
});
