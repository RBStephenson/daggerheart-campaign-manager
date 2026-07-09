import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as playerApi from '../api/player';
import * as srdApi from '../api/srd';
import CharacterWizard from '../pages/player/CharacterWizard';

vi.mock('../api/player');
vi.mock('../api/srd');
const mockedCreate = vi.mocked(playerApi.createCharacter);
const mockedSrd = vi.mocked(srdApi.getCharacterCreationData);

const SRD_DATA: srdApi.SrdCharacterCreationData = {
  version: 'test',
  traits: ['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge'],
  trait_array: [2, 1, 1, 0, 0, -1],
  starting: { level: 1, stress: 6, hope: 2, proficiency: 1 },
  classes: [
    {
      name: 'Bard',
      domains: ['Grace', 'Codex'],
      starting_evasion: 10,
      starting_hp: 5,
      class_items: ['A romance novel'],
      subclasses: [{ name: 'Troubadour', spellcast_trait: 'Presence' }],
    },
    {
      name: 'Warrior',
      domains: ['Blade', 'Bone'],
      starting_evasion: 11,
      starting_hp: 6,
      class_items: ['A sharpening stone'],
      subclasses: [{ name: 'Call of the Brave', spellcast_trait: null }],
    },
  ],
  ancestries: ['Human'],
  communities: ['Wanderborne'],
  domains: [
    { name: 'Grace', classes: ['Bard'] },
    { name: 'Codex', classes: ['Bard'] },
    { name: 'Blade', classes: ['Warrior'] },
    { name: 'Bone', classes: ['Warrior'] },
  ],
  domain_cards_l1: [
    { domain: 'Grace', name: 'Enrapture', type: 'spell', recall_cost: 0 },
    { domain: 'Codex', name: 'Book of Ava', type: 'grimoire', recall_cost: 2 },
    { domain: 'Blade', name: 'Whirlwind', type: 'ability', recall_cost: 0 },
  ],
  weapons_tier1: [
    {
      name: 'Rapier',
      trait: 'Presence',
      range: 'Melee',
      damage: 'd8 phy',
      burden: 'One-Handed',
      is_magic: false,
      feature: null,
    },
    {
      name: 'Dagger',
      trait: 'Finesse',
      range: 'Melee',
      damage: 'd8+1 phy',
      burden: 'One-Handed',
      is_magic: false,
      feature: null,
    },
    {
      name: 'Longsword',
      trait: 'Agility',
      range: 'Melee',
      damage: 'd10+3 phy',
      burden: 'Two-Handed',
      is_magic: false,
      feature: null,
    },
  ],
  armor_tier1: [{ name: 'Leather Armor', base_thresholds: [6, 13], base_score: 3, feature: null }],
};

async function completeWizard() {
  render(<CharacterWizard campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);
  const user = userEvent.setup();

  await screen.findByText('Character Name');

  // Step 0: name, class, subclass
  await user.type(screen.getByLabelText('Character Name'), 'Lyra');
  await user.selectOptions(screen.getByLabelText('Class'), 'Bard');
  await user.selectOptions(await screen.findByLabelText('Subclass'), 'Troubadour');
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 1: heritage
  await user.selectOptions(screen.getByLabelText('Ancestry'), 'Human');
  await user.selectOptions(screen.getByLabelText('Community'), 'Wanderborne');
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 2: traits
  for (const trait of SRD_DATA.traits) {
    const select = screen.getByRole('combobox', { name: new RegExp(`^${trait}$`) });
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    // Pick the first real option (index 0 is the blank placeholder).
    await user.selectOptions(select, options[1].value);
  }
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 3: equipment
  await user.selectOptions(screen.getByLabelText('Primary Weapon'), 'Rapier');
  await user.selectOptions(screen.getByLabelText('Armor'), 'Leather Armor');
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 4: experiences
  await user.type(screen.getByPlaceholderText(/Experience 1/), 'Storyteller');
  await user.type(screen.getByPlaceholderText(/Experience 2/), 'Charming');
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 5: domain cards
  const cardSelects = screen.getAllByRole('combobox');
  await user.selectOptions(cardSelects[0], 'Grace::Enrapture');
  await user.selectOptions(cardSelects[1], 'Codex::Book of Ava');
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // Step 6: background (skip)
  await user.click(screen.getByRole('button', { name: 'Next' }));

  return user;
}

describe('CharacterWizard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSrd.mockResolvedValue(SRD_DATA);
  });

  it('walks all steps and submits an assembled character sheet', async () => {
    mockedCreate.mockResolvedValue({
      id: 1,
      player_user_id: 1,
      campaign_id: 1,
      name: 'Lyra',
      char_class: 'Bard',
      ancestry: 'Human',
      community: 'Wanderborne',
      level: 1,
      extra: '{}',
      created_at: '2026-01-01T00:00:00Z',
    });
    const user = await completeWizard();

    await screen.findByText(/Lyra/);
    await user.click(screen.getByRole('button', { name: 'Create Character' }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const call = mockedCreate.mock.calls[0][0];
    expect(call.campaign_id).toBe(1);
    expect(call.name).toBe('Lyra');
    const sheet = JSON.parse(call.extra!);
    expect(sheet.char_class).toBe('Bard');
    expect(sheet.subclass).toBe('Troubadour');
    expect(sheet.domain_cards).toEqual([
      { domain: 'Grace', name: 'Enrapture' },
      { domain: 'Codex', name: 'Book of Ava' },
    ]);
    expect(sheet.experiences).toEqual([
      { name: 'Storyteller', modifier: 2 },
      { name: 'Charming', modifier: 2 },
    ]);
    expect(sheet.evasion).toBe(10);
    expect(sheet.hp_max).toBe(5);
  });

  it('blocks submission with duplicate domain card selections', async () => {
    render(<CharacterWizard campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);
    const user = userEvent.setup();
    await screen.findByText('Character Name');

    await user.type(screen.getByLabelText('Character Name'), 'Lyra');
    await user.selectOptions(screen.getByLabelText('Class'), 'Bard');
    await user.selectOptions(await screen.findByLabelText('Subclass'), 'Troubadour');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.selectOptions(screen.getByLabelText('Ancestry'), 'Human');
    await user.selectOptions(screen.getByLabelText('Community'), 'Wanderborne');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    for (const trait of SRD_DATA.traits) {
      const select = screen.getByRole('combobox', { name: new RegExp(`^${trait}$`) });
      const options = within(select).getAllByRole('option') as HTMLOptionElement[];
      await user.selectOptions(select, options[1].value);
    }
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.selectOptions(screen.getByLabelText('Primary Weapon'), 'Rapier');
    await user.selectOptions(screen.getByLabelText('Armor'), 'Leather Armor');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByPlaceholderText(/Experience 1/), 'Storyteller');
    await user.type(screen.getByPlaceholderText(/Experience 2/), 'Charming');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // The second domain-card select excludes whatever the first one picked,
    // so it's structurally impossible to pick the same card twice — assert that.
    const cardSelects = screen.getAllByRole('combobox');
    await user.selectOptions(cardSelects[0], 'Grace::Enrapture');
    const secondOptions = within(cardSelects[1]).getAllByRole('option') as HTMLOptionElement[];
    expect(secondOptions.some((o) => o.value === 'Grace::Enrapture')).toBe(false);
  });

  it('shows a two-handed primary weapon leaves no secondary-weapon field', async () => {
    render(<CharacterWizard campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);
    const user = userEvent.setup();
    await screen.findByText('Character Name');
    await user.selectOptions(screen.getByLabelText('Class'), 'Warrior');
    await user.selectOptions(await screen.findByLabelText('Subclass'), 'Call of the Brave');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    for (const trait of SRD_DATA.traits) {
      const select = screen.getByRole('combobox', { name: new RegExp(`^${trait}$`) });
      const options = within(select).getAllByRole('option') as HTMLOptionElement[];
      await user.selectOptions(select, options[1].value);
    }
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.selectOptions(screen.getByLabelText('Primary Weapon'), 'Longsword');
    expect(screen.queryByLabelText(/Secondary Weapon/)).not.toBeInTheDocument();
  });

  it('shows a load error if the SRD dataset fails to load', async () => {
    mockedSrd.mockRejectedValue(new Error('network error'));
    render(<CharacterWizard campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load character creation data/)).toBeInTheDocument(),
    );
  });
});
