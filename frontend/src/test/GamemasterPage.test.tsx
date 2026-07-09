import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as campaignsApi from '../api/campaigns';
import GamemasterPage from '../pages/gm/GamemasterPage';

vi.mock('../api/campaigns');
const mocked = vi.mocked(campaignsApi);

describe('GamemasterPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listSessions.mockResolvedValue([]);
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.listCampaigns.mockRejectedValue(new ApiError(404, 'not found'));
    render(<GamemasterPage />);
    await waitFor(() =>
      expect(screen.getByText(/campaigns feature is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('shows an empty state with no campaigns', async () => {
    mocked.listCampaigns.mockResolvedValue([]);
    render(<GamemasterPage />);
    await waitFor(() => expect(screen.getByText(/No campaigns yet/)).toBeInTheDocument());
  });

  it('lists campaigns with active session status', async () => {
    mocked.listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: 'Windmere',
        description: 'A start',
        gm_user_id: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.listSessions.mockResolvedValue([
      {
        id: 5,
        campaign_id: 1,
        status: 'active',
        room: 'session-5',
        started_at: '2026-01-01T00:00:00Z',
        ended_at: null,
      },
    ]);

    render(<GamemasterPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());
    expect(screen.getByText('Session active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument();
  });

  it('creates a campaign via the form', async () => {
    mocked.listCampaigns.mockResolvedValue([]);
    mocked.createCampaign.mockResolvedValue({
      id: 2,
      name: 'New Campaign',
      description: '',
      gm_user_id: 1,
      created_at: '2026-01-01T00:00:00Z',
    });

    render(<GamemasterPage />);
    await waitFor(() => expect(screen.getByText(/No campaigns yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Campaign name'), 'New Campaign');
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

    await waitFor(() =>
      expect(mocked.createCampaign).toHaveBeenCalledWith('New Campaign', ''),
    );
  });

  it('starts a session for a campaign with none active', async () => {
    mocked.listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: 'Windmere',
        description: '',
        gm_user_id: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.startSession.mockResolvedValue({
      id: 9,
      campaign_id: 1,
      status: 'active',
      room: 'session-9',
      started_at: '2026-01-01T00:00:00Z',
      ended_at: null,
    });

    render(<GamemasterPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await waitFor(() => expect(mocked.startSession).toHaveBeenCalledWith(1));
  });
});
