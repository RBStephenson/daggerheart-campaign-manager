import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as playerApi from '../api/player';
import CampaignStatusPanel from '../pages/player/CampaignStatusPanel';

vi.mock('../api/player');
const mocked = vi.mocked(playerApi);

describe('CampaignStatusPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
});
