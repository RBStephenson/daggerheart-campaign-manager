import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as cluesApi from '../api/clues';
import * as libraryApi from '../api/library';
import LibraryPage from '../pages/gm/LibraryPage';

vi.mock('../api/library');
vi.mock('../api/clues');
const mocked = vi.mocked(libraryApi);
const cluesMocked = vi.mocked(cluesApi);

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listEntities.mockResolvedValue([]);
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
    cluesMocked.listClues.mockResolvedValue([]);
    render(<LibraryPage />);
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('continents', 1));

    await userEvent.click(screen.getByRole('button', { name: 'Factions' }));
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('factions', 1));

    await userEvent.click(screen.getByRole('button', { name: 'Environments' }));
    await waitFor(() => expect(mocked.listEntities).toHaveBeenCalledWith('environments', 1));

    await userEvent.click(screen.getByRole('button', { name: 'Clues' }));
    await waitFor(() => expect(cluesMocked.listClues).toHaveBeenCalledWith(1));
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

  describe('Clues tab', () => {
    async function openCluesTab() {
      mocked.listWorlds.mockResolvedValue([
        { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' },
      ]);
      render(<LibraryPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Clues' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Clues' }));
      await waitFor(() => expect(cluesMocked.listClues).toHaveBeenCalledWith(1));
    }

    it('lists existing clues under their revelation heading', async () => {
      cluesMocked.listClues.mockResolvedValue([
        {
          id: 5,
          world_id: 1,
          text: 'Bloodstained ledger in the cellar',
          revelation: 'The steward is the thief',
          entity_type: null,
          entity_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]);
      await openCluesTab();

      await waitFor(() =>
        expect(screen.getByText('Bloodstained ledger in the cellar')).toBeInTheDocument(),
      );
      expect(screen.getByText('The steward is the thief (1)')).toBeInTheDocument();
    });

    it('groups clues by revelation with a visible count, ungrouped last', async () => {
      cluesMocked.listClues.mockResolvedValue([
        {
          id: 1,
          world_id: 1,
          text: 'Bloodstained ledger',
          revelation: 'The steward is the thief',
          entity_type: null,
          entity_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          world_id: 1,
          text: 'Muddy bootprints',
          revelation: '',
          entity_type: null,
          entity_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 3,
          world_id: 1,
          text: 'Torn ledger page found on the steward',
          revelation: 'The steward is the thief',
          entity_type: null,
          entity_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]);
      await openCluesTab();

      await waitFor(() => expect(screen.getByText('Bloodstained ledger')).toBeInTheDocument());
      expect(screen.getByText('The steward is the thief (2)')).toBeInTheDocument();
      expect(screen.getByText('Ungrouped (1)')).toBeInTheDocument();

      const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(headings).toEqual(['The steward is the thief (2)', 'Ungrouped (1)']);
    });

    it('shows an empty state when no clues exist yet', async () => {
      cluesMocked.listClues.mockResolvedValue([]);
      await openCluesTab();
      await waitFor(() => expect(screen.getByText(/No clues yet/)).toBeInTheDocument());
    });

    it('creates an unattached clue via the form', async () => {
      cluesMocked.listClues.mockResolvedValue([]);
      cluesMocked.createClue.mockResolvedValue({
        id: 6,
        world_id: 1,
        text: 'Torn letter',
        revelation: '',
        entity_type: null,
        entity_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });
      await openCluesTab();
      await waitFor(() => expect(screen.getByText(/No clues yet/)).toBeInTheDocument());

      await userEvent.type(screen.getByPlaceholderText('Clue text'), 'Torn letter');
      await userEvent.click(screen.getByRole('button', { name: 'Create clue' }));

      await waitFor(() =>
        expect(cluesMocked.createClue).toHaveBeenCalledWith(1, {
          text: 'Torn letter',
          revelation: '',
          entity_type: null,
          entity_id: null,
        }),
      );
    });

    it('edits and deletes an existing clue', async () => {
      cluesMocked.listClues.mockResolvedValue([
        {
          id: 7,
          world_id: 1,
          text: 'First draft',
          revelation: '',
          entity_type: null,
          entity_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]);
      cluesMocked.updateClue.mockResolvedValue({
        id: 7,
        world_id: 1,
        text: 'Revised text',
        revelation: 'New revelation',
        entity_type: null,
        entity_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });
      cluesMocked.deleteClue.mockResolvedValue(undefined);
      await openCluesTab();
      await waitFor(() => expect(screen.getByText('First draft')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const textbox = screen.getByDisplayValue('First draft');
      await userEvent.clear(textbox);
      await userEvent.type(textbox, 'Revised text');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(cluesMocked.updateClue).toHaveBeenCalledWith(1, 7, {
          text: 'Revised text',
          revelation: '',
        }),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(cluesMocked.deleteClue).toHaveBeenCalledWith(1, 7));
    });
  });
});
