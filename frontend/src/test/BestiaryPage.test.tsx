import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as bestiaryApi from '../api/bestiary';
import * as libraryApi from '../api/library';
import BestiaryPage from '../pages/gm/BestiaryPage';

vi.mock('../api/bestiary');
vi.mock('../api/library');
const mocked = vi.mocked(bestiaryApi);
const mockedLibrary = vi.mocked(libraryApi);

const acidBurrower = {
  name: 'ACID BURROWER',
  tier: 1,
  type: 'Solo',
  horde_hp_per_rank: null,
  description: 'A horse-sized insect with digging claws and acidic blood.',
  motives_and_tactics: 'Burrow, drag away, feed, reposition',
  difficulty: 14,
  threshold_major: 8,
  threshold_severe: 15,
  hp: 8,
  stress: 3,
  attack_modifier: '+3',
  standard_attack_name: 'Claws',
  standard_attack_range: 'Very Close',
  standard_attack_damage: '1d12+2 phy',
  experience: 'Tremor Sense +2',
  features: [{ name: 'Relentless', kind: 'passive' as const, text: 'Spend Fear to spotlight.', tag: '3' }],
};

const abandonedGrove = {
  name: 'ABANDONED GROVE',
  tier: 1,
  type: 'Exploration',
  description: 'A former druidic grove.',
  impulses: 'Draw in the curious, echo the past',
  difficulty: 11,
  potential_adversaries: 'Beasts (Bear, Dire Wolf)',
  features: [{ name: 'Overgrown Battlefield', kind: 'passive' as const, text: 'A battle happened here.' }],
};

describe('BestiaryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedLibrary.listWorlds.mockResolvedValue([]);
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.getBestiary.mockRejectedValue(new ApiError(404, 'not found'));
    render(<BestiaryPage />);
    await waitFor(() =>
      expect(screen.getByText(/bestiary feature is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('lists adversaries by default with counts', async () => {
    mocked.getBestiary.mockResolvedValue({ adversaries: [acidBurrower], environments: [abandonedGrove] });
    render(<BestiaryPage />);
    await waitFor(() => expect(screen.getByText('ACID BURROWER')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Adversaries (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Environments (1)' })).toBeInTheDocument();
  });

  it('filters adversaries by search text', async () => {
    mocked.getBestiary.mockResolvedValue({ adversaries: [acidBurrower], environments: [] });
    render(<BestiaryPage />);
    await waitFor(() => expect(screen.getByText('ACID BURROWER')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Search by name'), 'zombie');
    await waitFor(() => expect(screen.getByText('No adversaries match.')).toBeInTheDocument());
  });

  it('switches to the Environments tab', async () => {
    mocked.getBestiary.mockResolvedValue({ adversaries: [acidBurrower], environments: [abandonedGrove] });
    render(<BestiaryPage />);
    await waitFor(() => expect(screen.getByText('ACID BURROWER')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Environments (1)' }));
    expect(screen.getByText('ABANDONED GROVE')).toBeInTheDocument();
    expect(screen.queryByText('ACID BURROWER')).not.toBeInTheDocument();
  });

  it('expands a card to show the full stat block', async () => {
    mocked.getBestiary.mockResolvedValue({ adversaries: [acidBurrower], environments: [] });
    render(<BestiaryPage />);
    await waitFor(() => expect(screen.getByText('ACID BURROWER')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /ACID BURROWER/ }));
    expect(screen.getByText(/Burrow, drag away, feed, reposition/)).toBeInTheDocument();
    expect(screen.getByText(/Relentless/)).toBeInTheDocument();
  });

  it('prompts to create a Library world before an adversary can be added', async () => {
    mocked.getBestiary.mockResolvedValue({ adversaries: [acidBurrower], environments: [] });
    mockedLibrary.listWorlds.mockResolvedValue([]);
    render(<BestiaryPage />);
    await waitFor(() => expect(screen.getByText('ACID BURROWER')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /ACID BURROWER/ }));
    expect(screen.getByText(/Create a Library world first/)).toBeInTheDocument();
  });

  it('adds an adversary to the Library when a world exists', async () => {
    mocked.getBestiary.mockResolvedValue({ adversaries: [acidBurrower], environments: [] });
    mockedLibrary.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedLibrary.createEntity.mockResolvedValue({
      id: 5,
      world_id: 1,
      name: 'ACID BURROWER',
      summary: acidBurrower.description,
      extra: JSON.stringify(acidBurrower),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    render(<BestiaryPage />);
    await waitFor(() => expect(screen.getByText('ACID BURROWER')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /ACID BURROWER/ }));
    await waitFor(() => expect(mockedLibrary.listWorlds).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Add to Library' }));

    await waitFor(() =>
      expect(mockedLibrary.createEntity).toHaveBeenCalledWith('adversaries', 1, {
        name: 'ACID BURROWER',
        summary: acidBurrower.description,
        extra: JSON.stringify(acidBurrower),
      }),
    );
    await waitFor(() => expect(screen.getByText('Added to Library')).toBeInTheDocument());
  });
});
