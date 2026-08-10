import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as campaignsApi from '../api/campaigns';
import MembersPanel from '../pages/gm/MembersPanel';

vi.mock('../api/campaigns');
const mocked = vi.mocked(campaignsApi);

describe('MembersPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows an empty state with no members', async () => {
    mocked.listMembers.mockResolvedValue([]);
    render(<MembersPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No players added yet/)).toBeInTheDocument());
  });

  it('lists existing members with a remove button', async () => {
    mocked.listMembers.mockResolvedValue([
      {
        id: 1,
        campaign_id: 1,
        player_user_id: 7,
        player_username: 'alice',
        joined_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render(<MembersPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('adds a player by username via the form', async () => {
    mocked.listMembers.mockResolvedValue([]);
    mocked.addMember.mockResolvedValue({
      id: 1,
      campaign_id: 1,
      player_user_id: 7,
      player_username: 'alice',
      joined_at: '2026-01-01T00:00:00Z',
    });

    render(<MembersPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No players added yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Player username'), 'alice');
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));

    await waitFor(() => expect(mocked.addMember).toHaveBeenCalledWith(1, 'alice'));
  });

  it('shows an error message when adding fails', async () => {
    mocked.listMembers.mockResolvedValue([]);
    mocked.addMember.mockRejectedValue(new ApiError(404, 'No such player'));

    render(<MembersPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText(/No players added yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Player username'), 'ghost');
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));

    await waitFor(() => expect(screen.getByText('No such player')).toBeInTheDocument());
  });

  it('removes a member', async () => {
    mocked.listMembers.mockResolvedValue([
      {
        id: 1,
        campaign_id: 1,
        player_user_id: 7,
        player_username: 'alice',
        joined_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.removeMember.mockResolvedValue(undefined);

    render(<MembersPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(mocked.removeMember).toHaveBeenCalledWith(1, 7));
  });
});
