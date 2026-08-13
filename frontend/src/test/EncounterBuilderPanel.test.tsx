import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as bestiaryApi from '../api/bestiary';
import * as campaignsApi from '../api/campaigns';
import EncounterBuilderPanel from '../pages/gm/EncounterBuilderPanel';

vi.mock('../api/campaigns');
vi.mock('../api/bestiary');
const mocked = vi.mocked(campaignsApi);
const mockedBestiary = vi.mocked(bestiaryApi);

const acidBurrower = {
  name: 'Acid Burrower',
  tier: 1,
  type: 'Solo',
  horde_hp_per_rank: null,
  description: '',
  motives_and_tactics: '',
  difficulty: 12,
  threshold_major: 7,
  threshold_severe: 12,
  hp: 8,
  stress: 3,
  attack_modifier: '+2',
  standard_attack_name: 'Burrowing Bite',
  standard_attack_range: 'Melee',
  standard_attack_damage: '1d10+2',
  experience: null,
  features: [],
};

describe('EncounterBuilderPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getEncounterBudget.mockResolvedValue({ party_size: 4, budget: 14 });
    mockedBestiary.getBestiary.mockResolvedValue({
      adversaries: [acidBurrower],
      environments: [],
    });
  });

  it('shows the party size and budget', async () => {
    render(<EncounterBuilderPanel campaignId={1} />);
    await waitFor(() =>
      expect(screen.getByText('Party of 4 — budget 14')).toBeInTheDocument(),
    );
  });

  it('refetches the budget when an adjustment is toggled', async () => {
    render(<EncounterBuilderPanel campaignId={1} />);
    await waitFor(() => expect(mocked.getEncounterBudget).toHaveBeenCalledTimes(1));

    mocked.getEncounterBudget.mockResolvedValue({ party_size: 4, budget: 16 });
    await userEvent.click(screen.getByLabelText(/Harder or longer fight/));

    await waitFor(() =>
      expect(mocked.getEncounterBudget).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ harder_fight: true }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText('Party of 4 — budget 16')).toBeInTheDocument(),
    );
  });

  it('adds an adversary from search and shows the running cost', async () => {
    render(<EncounterBuilderPanel campaignId={1} />);
    await waitFor(() =>
      expect(screen.getByText('Party of 4 — budget 14')).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByPlaceholderText('Search adversaries by name'),
      'Acid',
    );
    await waitFor(() => expect(screen.getByText(/Acid Burrower/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Solo costs 5 Battle Points
    await waitFor(() => expect(screen.getByText('5 / 14')).toBeInTheDocument());
  });

  it('shows an over-budget indicator when spent exceeds the budget', async () => {
    mocked.getEncounterBudget.mockResolvedValue({ party_size: 1, budget: 3 });
    render(<EncounterBuilderPanel campaignId={1} />);
    await waitFor(() =>
      expect(screen.getByText('Party of 1 — budget 3')).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByPlaceholderText('Search adversaries by name'),
      'Acid',
    );
    await waitFor(() => expect(screen.getByText(/Acid Burrower/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByText(/over budget/)).toBeInTheDocument());
  });

  it('removes an added adversary', async () => {
    render(<EncounterBuilderPanel campaignId={1} />);
    await waitFor(() =>
      expect(screen.getByText('Party of 4 — budget 14')).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByPlaceholderText('Search adversaries by name'),
      'Acid',
    );
    await waitFor(() => expect(screen.getByText(/Acid Burrower/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByText('5 / 14')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.getByText('0 / 14')).toBeInTheDocument());
    expect(screen.getByText('No adversaries added yet.')).toBeInTheDocument();
  });

  it('shows an error message when the budget fetch fails', async () => {
    mocked.getEncounterBudget.mockRejectedValue(new ApiError(500, 'Budget unavailable'));
    render(<EncounterBuilderPanel campaignId={1} />);

    await waitFor(() => expect(screen.getByText('Budget unavailable')).toBeInTheDocument());
  });
});
