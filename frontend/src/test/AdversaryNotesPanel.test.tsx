import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as libraryApi from '../api/library';
import AdversaryNotesPanel from '../pages/gm/AdversaryNotesPanel';

vi.mock('../api/library');
const mocked = vi.mocked(libraryApi);

const world = { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' };

function adversary(overrides: Partial<libraryApi.LibraryEntity> = {}): libraryApi.LibraryEntity {
  return {
    id: 1,
    name: 'Grim Bailiff',
    summary: '',
    extra: '{}',
    notes: '',
    world_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AdversaryNotesPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listWorlds.mockResolvedValue([world]);
  });

  it('shows an empty state with no adversaries', async () => {
    mocked.listEntities.mockResolvedValue([]);
    render(<AdversaryNotesPanel />);
    await waitFor(() =>
      expect(screen.getByText(/No adversaries in your Library yet/)).toBeInTheDocument(),
    );
  });

  it('lists adversaries with their GM notes', async () => {
    mocked.listEntities.mockResolvedValue([
      adversary({ notes: 'Opens with the Fear feature immediately.' }),
    ]);
    render(<AdversaryNotesPanel />);
    await waitFor(() => expect(screen.getByText('Grim Bailiff')).toBeInTheDocument());
    expect(screen.getByText('Opens with the Fear feature immediately.')).toBeInTheDocument();
    expect(mocked.listEntities).toHaveBeenCalledWith('adversaries', 1);
  });

  it("shows a placeholder for an adversary with no notes yet", async () => {
    mocked.listEntities.mockResolvedValue([adversary({ notes: '' })]);
    render(<AdversaryNotesPanel />);
    await waitFor(() => expect(screen.getByText('Grim Bailiff')).toBeInTheDocument());
    expect(screen.getByText('No GM notes yet.')).toBeInTheDocument();
  });

  it('filters the list by search query', async () => {
    mocked.listEntities.mockResolvedValue([
      adversary({ id: 1, name: 'Grim Bailiff' }),
      adversary({ id: 2, name: 'Ash Wyrm' }),
    ]);
    render(<AdversaryNotesPanel />);
    await waitFor(() => expect(screen.getByText('Grim Bailiff')).toBeInTheDocument());
    expect(screen.getByText('Ash Wyrm')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search adversaries...'), 'wyrm');

    await waitFor(() => expect(screen.queryByText('Grim Bailiff')).not.toBeInTheDocument());
    expect(screen.getByText('Ash Wyrm')).toBeInTheDocument();
  });

  it('handles no world existing yet without crashing', async () => {
    mocked.listWorlds.mockResolvedValue([]);
    render(<AdversaryNotesPanel />);
    await waitFor(() =>
      expect(screen.getByText(/No adversaries in your Library yet/)).toBeInTheDocument(),
    );
    expect(mocked.listEntities).not.toHaveBeenCalled();
  });
});
