import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as campaignsApi from '../api/campaigns';
import CountdownsPanel from '../pages/gm/CountdownsPanel';

vi.mock('../api/campaigns');
const mocked = vi.mocked(campaignsApi);

const countdown = {
  id: 1,
  campaign_id: 1,
  name: 'Volley of Arrows',
  starting_value: 3,
  current_value: 3,
  loop: false,
  triggered_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('CountdownsPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows an empty state with no countdowns', async () => {
    mocked.listCountdowns.mockResolvedValue([]);
    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No countdowns yet/)).toBeInTheDocument());
  });

  it('lists existing countdowns with their progress', async () => {
    mocked.listCountdowns.mockResolvedValue([countdown]);
    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Volley of Arrows')).toBeInTheDocument());
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('flags a looping countdown', async () => {
    mocked.listCountdowns.mockResolvedValue([{ ...countdown, loop: true }]);
    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('(loop)')).toBeInTheDocument());
  });

  it('flags a triggered countdown', async () => {
    mocked.listCountdowns.mockResolvedValue([
      { ...countdown, current_value: 0, triggered_at: '2026-01-02T00:00:00Z' },
    ]);
    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Triggered!')).toBeInTheDocument());
  });

  it('creates a countdown via the form', async () => {
    mocked.listCountdowns.mockResolvedValue([]);
    mocked.createCountdown.mockResolvedValue(countdown);

    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No countdowns yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Countdown name'), 'Volley of Arrows');
    await userEvent.type(screen.getByPlaceholderText('Starting value'), '3');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create countdown' }));

    await waitFor(() =>
      expect(mocked.createCountdown).toHaveBeenCalledWith(1, 'Volley of Arrows', 3, true),
    );
  });

  it('shows an error message when creation fails', async () => {
    mocked.listCountdowns.mockResolvedValue([]);
    mocked.createCountdown.mockRejectedValue(new ApiError(422, 'Invalid starting value'));

    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No countdowns yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Countdown name'), 'Bad');
    await userEvent.type(screen.getByPlaceholderText('Starting value'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Create countdown' }));

    await waitFor(() => expect(screen.getByText('Invalid starting value')).toBeInTheDocument());
  });

  it('advances a countdown', async () => {
    mocked.listCountdowns.mockResolvedValue([countdown]);
    mocked.advanceCountdown.mockResolvedValue({ ...countdown, current_value: 2 });

    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('3 / 3')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Advance Volley of Arrows' }));

    await waitFor(() => expect(mocked.advanceCountdown).toHaveBeenCalledWith(1, 1, 1));
    await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument());
  });

  it('deletes a countdown', async () => {
    mocked.listCountdowns.mockResolvedValue([countdown]);
    mocked.deleteCountdown.mockResolvedValue(undefined);

    render(<CountdownsPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Volley of Arrows')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mocked.deleteCountdown).toHaveBeenCalledWith(1, 1));
  });
});
