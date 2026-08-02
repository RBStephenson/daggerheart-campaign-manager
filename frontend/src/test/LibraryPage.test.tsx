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

  it('lists Continents by default once a world exists', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([]);
    render(<LibraryPage />);

    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('continents', 1));
    expect(screen.getByText(/No continents yet/)).toBeInTheDocument();
  });

  it('switches top-level tabs and fetches the new segment', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([]);
    render(<LibraryPage />);
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('continents', 1));

    await userEvent.click(screen.getByRole('button', { name: 'Factions' }));
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('factions', 1));
  });

  it('creates a continent via the form, including its kind field', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockResolvedValue([]);
    mocked.createEntity.mockResolvedValue({
      id: 2,
      world_id: 1,
      name: 'Tharivor',
      summary: '',
      extra: '',
      kind: 'primary continent',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText(/No continents yet/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('Continent name'), 'Tharivor');
    await userEvent.type(screen.getByPlaceholderText(/Kind/), 'primary continent');
    await userEvent.click(screen.getByRole('button', { name: 'Create continent' }));

    await waitFor(() =>
      expect(mocked.createEntity).toHaveBeenCalledWith('continents', 1, {
        name: 'Tharivor',
        summary: '',
        extra: '',
        kind: 'primary continent',
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
        name: 'Tharivor',
        summary: 'The primary continent.',
        extra: '',
        kind: 'primary continent',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mocked.deleteEntity.mockResolvedValue(undefined);
    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText('Tharivor')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocked.deleteEntity).toHaveBeenCalledWith('continents', 1, 2));
  });

  it('drills from a continent into its regions, and from a region into its locations', async () => {
    mocked.listWorlds.mockResolvedValue([
      { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mocked.listEntities.mockImplementation((segment, parentId) => {
      if (segment === 'continents' && parentId === 1) {
        return Promise.resolve([
          {
            id: 10,
            world_id: 1,
            name: 'Tharivor',
            summary: '',
            extra: '',
            kind: '',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      if (segment === 'regions' && parentId === 10) {
        return Promise.resolve([
          {
            id: 20,
            continent_id: 10,
            name: 'Hillford Valley',
            summary: '',
            extra: '',
            kind: '',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      if (segment === 'locations' && parentId === 20) {
        return Promise.resolve([
          {
            id: 30,
            region_id: 20,
            name: 'Hillford',
            summary: '',
            extra: '',
            kind: 'town',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText('Tharivor')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'View Regions' }));
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('regions', 10));
    await waitFor(() => expect(screen.getByText('Hillford Valley')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'View Locations' }));
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('locations', 20));
    await waitFor(() => expect(screen.getByText('Hillford')).toBeInTheDocument());
    expect(screen.getByText('town')).toBeInTheDocument();
  });
});
