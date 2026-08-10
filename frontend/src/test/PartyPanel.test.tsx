import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as campaignsApi from '../api/campaigns';
import type { Envelope } from '../hooks/useWebSocket';
import PartyPanel from '../pages/gm/PartyPanel';

vi.mock('../api/campaigns');
const mocked = vi.mocked(campaignsApi);

let capturedOnMessage: ((envelope: Envelope) => void) | undefined;
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: (_room: string | null, opts?: { onMessage?: (e: Envelope) => void }) => {
    capturedOnMessage = opts?.onMessage;
    return { status: 'open', send: vi.fn() };
  },
}));

const character = {
  id: 1,
  player_user_id: 7,
  campaign_id: 1,
  name: 'Restwell',
  char_class: 'Bard',
  ancestry: 'Human',
  community: 'Wanderborne',
  level: 1,
  extra: JSON.stringify({ hp_max: 5, stress_max: 6 }),
  hp_marked: 2,
  stress_marked: 1,
  hope: 3,
  armor_slots_marked: 0,
  created_at: '2026-01-01T00:00:00Z',
};

describe('PartyPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    capturedOnMessage = undefined;
  });

  it('shows an empty state with no characters', async () => {
    mocked.getParty.mockResolvedValue([]);
    render(<PartyPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('No characters yet.')).toBeInTheDocument());
  });

  it('lists a character with its live sheet stats', async () => {
    mocked.getParty.mockResolvedValue([{ player_username: 'alice', character }]);
    render(<PartyPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Restwell')).toBeInTheDocument());
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bard/)).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
    expect(screen.getByText('3 / 6')).toBeInTheDocument();
  });

  it('skips sheet stats for a character with no completed sheet', async () => {
    mocked.getParty.mockResolvedValue([
      { player_username: 'alice', character: { ...character, extra: '{}' } },
    ]);
    render(<PartyPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Restwell')).toBeInTheDocument());
    expect(screen.queryByText(/\/ 5/)).not.toBeInTheDocument();
  });

  it('lists multiple characters from multiple players', async () => {
    mocked.getParty.mockResolvedValue([
      { player_username: 'alice', character },
      { player_username: 'bob', character: { ...character, id: 2, name: 'Grimtooth' } },
    ]);
    render(<PartyPanel campaignId={1} />);
    await waitFor(() => expect(screen.getByText('Restwell')).toBeInTheDocument());
    expect(screen.getByText('Grimtooth')).toBeInTheDocument();
  });

  it('updates a character live from a character_state WebSocket message', async () => {
    mocked.getParty.mockResolvedValue([{ player_username: 'alice', character }]);
    render(<PartyPanel campaignId={1} room="session-1" />);
    await waitFor(() => expect(screen.getByText('2 / 5')).toBeInTheDocument());

    capturedOnMessage?.({
      type: 'character_state',
      payload: { ...character, hp_marked: 4 },
    });

    await waitFor(() => expect(screen.getByText('4 / 5')).toBeInTheDocument());
  });

  it('ignores a character_state message for a character not in this party', async () => {
    mocked.getParty.mockResolvedValue([{ player_username: 'alice', character }]);
    render(<PartyPanel campaignId={1} room="session-1" />);
    await waitFor(() => expect(screen.getByText('2 / 5')).toBeInTheDocument());

    capturedOnMessage?.({
      type: 'character_state',
      payload: { ...character, id: 999, hp_marked: 4 },
    });

    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });
});
