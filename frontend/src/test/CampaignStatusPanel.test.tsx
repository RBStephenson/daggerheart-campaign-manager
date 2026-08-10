import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as playerApi from '../api/player';
import type { Envelope } from '../hooks/useWebSocket';
import CampaignStatusPanel from '../pages/player/CampaignStatusPanel';

vi.mock('../api/player');
const mocked = vi.mocked(playerApi);

let capturedOnMessage: ((envelope: Envelope) => void) | undefined;
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: (_room: string | null, opts?: { onMessage?: (e: Envelope) => void }) => {
    capturedOnMessage = opts?.onMessage;
    return { status: 'open', send: vi.fn() };
  },
}));

describe('CampaignStatusPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    capturedOnMessage = undefined;
  });

  it('renders nothing when the flag is off (404)', async () => {
    mocked.getCampaignFear.mockRejectedValue(new ApiError(404, 'not found'));
    mocked.listCampaignCountdowns.mockRejectedValue(new ApiError(404, 'not found'));
    const { container } = render(<CampaignStatusPanel campaignId={1} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the Fear pool value', async () => {
    mocked.getCampaignFear.mockResolvedValue({ fear: 4 });
    mocked.listCampaignCountdowns.mockResolvedValue([]);
    render(<CampaignStatusPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('4 / 12')).toBeInTheDocument());
  });

  it('lists active countdowns', async () => {
    mocked.getCampaignFear.mockResolvedValue({ fear: 0 });
    mocked.listCampaignCountdowns.mockResolvedValue([
      {
        id: 1,
        campaign_id: 1,
        name: 'Ashen Cloud',
        starting_value: 3,
        current_value: 1,
        loop: true,
        triggered_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render(<CampaignStatusPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Ashen Cloud')).toBeInTheDocument());
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('(loop)')).toBeInTheDocument();
  });

  it('updates Fear live from a WebSocket message', async () => {
    mocked.getCampaignFear.mockResolvedValue({ fear: 4 });
    mocked.listCampaignCountdowns.mockResolvedValue([]);
    render(<CampaignStatusPanel campaignId={1} room="session-1" />);
    await waitFor(() => expect(screen.getByText('4 / 12')).toBeInTheDocument());

    capturedOnMessage?.({ type: 'fear', payload: { fear: 7 } });

    await waitFor(() => expect(screen.getByText('7 / 12')).toBeInTheDocument());
  });

  it('adds a countdown live from a countdown_created message', async () => {
    mocked.getCampaignFear.mockResolvedValue({ fear: 0 });
    mocked.listCampaignCountdowns.mockResolvedValue([]);
    render(<CampaignStatusPanel campaignId={1} room="session-1" />);
    await waitFor(() => expect(mocked.listCampaignCountdowns).toHaveBeenCalled());

    capturedOnMessage?.({
      type: 'countdown_created',
      payload: {
        id: 1,
        campaign_id: 1,
        name: 'Volley of Arrows',
        starting_value: 3,
        current_value: 3,
        loop: false,
        triggered_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    await waitFor(() => expect(screen.getByText('Volley of Arrows')).toBeInTheDocument());
  });

  it('updates and removes a countdown live', async () => {
    mocked.getCampaignFear.mockResolvedValue({ fear: 0 });
    mocked.listCampaignCountdowns.mockResolvedValue([
      {
        id: 1,
        campaign_id: 1,
        name: 'Ashen Cloud',
        starting_value: 3,
        current_value: 3,
        loop: false,
        triggered_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render(<CampaignStatusPanel campaignId={1} room="session-1" />);
    await waitFor(() => expect(screen.getByText('3 / 3')).toBeInTheDocument());

    capturedOnMessage?.({
      type: 'countdown_updated',
      payload: {
        id: 1,
        campaign_id: 1,
        name: 'Ashen Cloud',
        starting_value: 3,
        current_value: 2,
        loop: false,
        triggered_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    });
    await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument());

    capturedOnMessage?.({ type: 'countdown_deleted', payload: { id: 1 } });
    await waitFor(() => expect(screen.queryByText('Ashen Cloud')).not.toBeInTheDocument());
  });
});
