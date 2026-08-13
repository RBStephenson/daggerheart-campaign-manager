import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as campaignsApi from '../api/campaigns';
import * as gmMovesApi from '../api/gmMoves';
import FearTracker from '../pages/gm/FearTracker';

vi.mock('../api/campaigns');
vi.mock('../api/gmMoves');
const mocked = vi.mocked(campaignsApi);
const movesMocked = vi.mocked(gmMovesApi);

const moves = {
  when_to_move: ['Rolls with Fear on an action roll'],
  soft_vs_hard: {
    soft: 'Soft moves go easier on the players.',
    hard: 'Hard moves are harsher.',
    guidance: 'Apply softer moves to Hope rolls and harder moves to Fear rolls.',
  },
  moves: ['Show how the world reacts', 'Spotlight an adversary'],
};

describe('FearTracker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('spends and gains Fear via the +/- buttons', async () => {
    mocked.adjustFear.mockResolvedValue({ fear: 4 });
    const onChange = vi.fn();
    render(<FearTracker campaignId={1} fear={5} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Spend a Fear' }));
    await waitFor(() => expect(mocked.adjustFear).toHaveBeenCalledWith(1, -1));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('disables spend at 0 and gain at 12', () => {
    render(<FearTracker campaignId={1} fear={0} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Spend a Fear' })).toBeDisabled();

    render(<FearTracker campaignId={1} fear={12} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Gain a Fear' })[1]).toBeDisabled();
  });

  it('does not fetch the GM-moves reference until opened', () => {
    render(<FearTracker campaignId={1} fear={5} onChange={vi.fn()} />);
    expect(movesMocked.getGmMoves).not.toHaveBeenCalled();
  });

  it('opens the GM-moves reference popover and shows the fetched list', async () => {
    movesMocked.getGmMoves.mockResolvedValue(moves);
    render(<FearTracker campaignId={1} fear={5} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'GM moves reference' }));
    await waitFor(() => expect(screen.getByText('Show how the world reacts')).toBeInTheDocument());
    expect(screen.getByText('Spotlight an adversary')).toBeInTheDocument();
    expect(movesMocked.getGmMoves).toHaveBeenCalledTimes(1);
  });

  it('closes the popover via its close button', async () => {
    movesMocked.getGmMoves.mockResolvedValue(moves);
    render(<FearTracker campaignId={1} fear={5} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'GM moves reference' }));
    await waitFor(() => expect(screen.getByText('Show how the world reacts')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Close GM moves reference' }));
    expect(screen.queryByText('Show how the world reacts')).not.toBeInTheDocument();
  });

  it('shows an error if the reference fails to load', async () => {
    movesMocked.getGmMoves.mockRejectedValue(new Error('nope'));
    render(<FearTracker campaignId={1} fear={5} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'GM moves reference' }));
    await waitFor(() =>
      expect(screen.getByText(/Couldn't load the GM-moves reference/)).toBeInTheDocument(),
    );
  });
});
