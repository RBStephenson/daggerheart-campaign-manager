import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as playerApi from '../api/player';
import PlayerPage from '../pages/player/PlayerPage';

vi.mock('../api/player');
const mocked = vi.mocked(playerApi);

const campaign = {
  id: 1,
  name: 'Windmere',
  description: '',
  gm_user_id: 1,
  created_at: '2026-01-01T00:00:00Z',
};

const character = {
  id: 1,
  player_user_id: 1,
  campaign_id: 1,
  name: 'Kael',
  char_class: 'Warrior',
  ancestry: 'Human',
  community: 'Highborne',
  level: 1,
  extra: '{}',
  created_at: '2026-01-01T00:00:00Z',
};

describe('PlayerPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.listMyCampaigns.mockRejectedValue(new ApiError(404, 'not found'));
    mocked.listMyCharacters.mockResolvedValue([]);
    render(<PlayerPage />);
    await waitFor(() =>
      expect(screen.getByText(/player area is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('shows empty states with no campaigns or characters', async () => {
    mocked.listMyCampaigns.mockResolvedValue([]);
    mocked.listMyCharacters.mockResolvedValue([]);
    render(<PlayerPage />);
    await waitFor(() =>
      expect(screen.getByText(/haven't been added to a campaign/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('No characters yet.')).toBeInTheDocument();
  });

  it('lists campaigns and characters', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([character]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });

    render(<PlayerPage />);
    await waitFor(() => expect(screen.getAllByText('Windmere').length).toBeGreaterThan(0));
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.getByText(/Warrior.*Human.*Highborne/)).toBeInTheDocument();
  });

  it('creates a character via the form', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.createCharacter.mockResolvedValue(character);

    render(<PlayerPage />);
    await waitFor(() => expect(screen.getByText('No characters yet.')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Character name'), 'Kael');
    await userEvent.click(screen.getByRole('button', { name: 'Create character' }));

    await waitFor(() =>
      expect(mocked.createCharacter).toHaveBeenCalledWith(
        expect.objectContaining({ campaign_id: 1, name: 'Kael' }),
      ),
    );
  });

  it('deletes a character', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([character]);
    mocked.getNote.mockResolvedValue({ campaign_id: 1, body: '', updated_at: '2026-01-01T00:00:00Z' });
    mocked.deleteCharacter.mockResolvedValue(undefined);

    render(<PlayerPage />);
    await waitFor(() => expect(screen.getByText('Kael')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocked.deleteCharacter).toHaveBeenCalledWith(1));
  });

  it('loads and saves a note', async () => {
    mocked.listMyCampaigns.mockResolvedValue([campaign]);
    mocked.listMyCharacters.mockResolvedValue([]);
    mocked.getNote.mockResolvedValue({
      campaign_id: 1,
      body: 'existing note',
      updated_at: '2026-01-01T00:00:00Z',
    });
    mocked.saveNote.mockResolvedValue({
      campaign_id: 1,
      body: 'updated note',
      updated_at: '2026-01-01T00:01:00Z',
    });

    render(<PlayerPage />);
    const textarea = await screen.findByDisplayValue('existing note');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'updated note');

    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(mocked.saveNote).toHaveBeenCalledWith(1, 'updated note'));
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
  });
});
