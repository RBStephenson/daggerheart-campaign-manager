import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as libraryApi from '../api/library';
import LibraryPage from '../pages/gm/LibraryPage';

vi.mock('../api/library');
const mocked = vi.mocked(libraryApi);

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows a disabled message when the backend 404s', async () => {
    mocked.listWorlds.mockRejectedValue(new ApiError(404, 'not found'));
    render(<LibraryPage />);
    await waitFor(() =>
      expect(screen.getByText(/library feature is currently disabled/i)).toBeInTheDocument(),
    );
  });

  it('prompts to create a world when none exists yet', async () => {
    mocked.listWorlds.mockResolvedValue([]);
    mocked.createWorld.mockResolvedValue({
      id: 1,
      name: 'Aetheris',
      created_at: '2026-01-01T00:00:00Z',
    });
    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText(/Name your world/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('World name'), 'Aetheris');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));

    await waitFor(() => expect(mocked.createWorld).toHaveBeenCalledWith('Aetheris'));
  });

  it('lists Regions by default once a world exists', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([]);
    render(<LibraryPage />);

    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith(1, 'regions'));
    expect(screen.getByText(/No regions yet/)).toBeInTheDocument();
  });

  it('switches entity type tabs and fetches the new type', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([]);
    render(<LibraryPage />);
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith(1, 'regions'));

    await userEvent.click(screen.getByRole('button', { name: 'Factions' }));
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith(1, 'factions'));
  });

  it('creates an entity via the form', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([]);
    mocked.createEntity.mockResolvedValue({
      id: 2,
      world_id: 1,
      name: 'Hillford',
      summary: '',
      extra: '',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText(/No regions yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Region name'), 'Hillford');
    await userEvent.click(screen.getByRole('button', { name: 'Create region' }));

    await waitFor(() =>
      expect(mocked.createEntity).toHaveBeenCalledWith(1, 'regions', {
        name: 'Hillford',
        summary: '',
        extra: '',
      }),
    );
  });

  it('lists existing entities and supports delete', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([
      {
        id: 2,
        world_id: 1,
        name: 'Hillford',
        summary: 'A frontier town.',
        extra: '',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.deleteEntity.mockResolvedValue(undefined);
    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText('Hillford')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocked.deleteEntity).toHaveBeenCalledWith(1, 'regions', 2));
  });
});
