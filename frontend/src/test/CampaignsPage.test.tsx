import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as campaignsApi from '../api/campaigns';
import * as sessionPlansApi from '../api/sessionPlans';
import * as appSettings from '../context/AppSettingsContext';
import CampaignsPage from '../pages/gm/CampaignsPage';

vi.mock('../api/campaigns');
vi.mock('../api/sessionPlans');
vi.mock('../context/AppSettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AppSettingsContext')>();
  return { ...actual, useAppSettings: vi.fn(() => ({ settings: actual.DEFAULTS, loading: false, updateSettings: vi.fn() })) };
});
vi.mock('../pages/gm/MembersPanel', () => ({
  default: ({ campaignId }: { campaignId: number }) => (
    <div data-testid="members-panel">{campaignId}</div>
  ),
}));
vi.mock('../pages/gm/InvitePlayerPanel', () => ({
  default: () => <div data-testid="invite-player-panel" />,
}));
vi.mock('../components/ChatPanel', () => ({
  default: ({ room }: { room: string }) => <div data-testid="chat-panel">{room}</div>,
}));
const mocked = vi.mocked(campaignsApi);
const mockedPlans = vi.mocked(sessionPlansApi);
const mockedSettings = vi.mocked(appSettings.useAppSettings);

describe('CampaignsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listSessions.mockResolvedValue([]);
    mockedSettings.mockReturnValue({
      settings: appSettings.DEFAULTS,
      loading: false,
      updateSettings: vi.fn(),
    });
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.listCampaigns.mockRejectedValue(new ApiError(404, 'not found'));
    render(<CampaignsPage />);
    await waitFor(() =>
      expect(screen.getByText(/campaigns feature is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('shows an empty state with no campaigns', async () => {
    mocked.listCampaigns.mockResolvedValue([]);
    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByText(/No campaigns yet/)).toBeInTheDocument());
  });

  it('always renders the invite-player panel', async () => {
    mocked.listCampaigns.mockResolvedValue([]);
    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByTestId('invite-player-panel')).toBeInTheDocument());
  });

  it('lists campaigns with active session status', async () => {
    mocked.listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: 'Windmere',
        description: 'A start',
        gm_user_id: 1,
        fear: 0,
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

    render(<CampaignsPage />);
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
      fear: 0,
      created_at: '2026-01-01T00:00:00Z',
    });

    render(<CampaignsPage />);
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
        fear: 0,
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

    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await waitFor(() => expect(mocked.startSession).toHaveBeenCalledWith(1));
  });

  it('toggles the session plans panel for a campaign', async () => {
    mocked.listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: 'Windmere',
        description: '',
        gm_user_id: 1,
        fear: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mockedPlans.listSessionPlans.mockResolvedValue([]);

    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Session plans' }));
    await waitFor(() => expect(mockedPlans.listSessionPlans).toHaveBeenCalledWith(1));
    expect(screen.getByRole('button', { name: 'Hide session plans' })).toBeInTheDocument();
  });

  it('toggles the members panel for a campaign', async () => {
    mocked.listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: 'Windmere',
        description: '',
        gm_user_id: 1,
        fear: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(screen.getByTestId('members-panel')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Hide members' })).toBeInTheDocument();
  });

  it('hides the Fear tracker when combat_tools_enabled is off', async () => {
    mocked.listCampaigns.mockResolvedValue([
      { id: 1, name: 'Windmere', description: '', gm_user_id: 1, fear: 3, created_at: '2026-01-01T00:00:00Z' },
    ]);

    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());
    expect(screen.queryByRole('group', { name: 'Fear pool' })).not.toBeInTheDocument();
  });

  it('shows and adjusts the Fear tracker when combat_tools_enabled is on', async () => {
    mockedSettings.mockReturnValue({
      settings: { ...appSettings.DEFAULTS, combat_tools_enabled: true },
      loading: false,
      updateSettings: vi.fn(),
    });
    mocked.listCampaigns.mockResolvedValue([
      { id: 1, name: 'Windmere', description: '', gm_user_id: 1, fear: 3, created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.adjustFear.mockResolvedValue({ fear: 4 });

    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByText('Windmere')).toBeInTheDocument());
    expect(screen.getByRole('group', { name: 'Fear pool' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Gain a Fear' }));
    await waitFor(() => expect(mocked.adjustFear).toHaveBeenCalledWith(1, 1));
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
  });
});
