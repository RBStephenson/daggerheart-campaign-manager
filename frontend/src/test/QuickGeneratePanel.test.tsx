import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as generatorsApi from '../api/generators';
import * as libraryApi from '../api/library';
import QuickGeneratePanel from '../pages/gm/QuickGeneratePanel';

vi.mock('../api/generators');
vi.mock('../api/library');
const mocked = vi.mocked(generatorsApi);
const mockedLibrary = vi.mocked(libraryApi);

const world = { id: 1, name: 'Aetheris', created_at: '2026-01-01T00:00:00Z' };

const npcSuggestion = {
  kind: 'npc' as const,
  name: 'Corir',
  role: 'innkeeper',
  motivation: 'wants out of debt',
  quirk: 'hums constantly',
};

describe('QuickGeneratePanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedLibrary.listWorlds.mockResolvedValue([world]);
  });

  it('generates and displays a name suggestion', async () => {
    mocked.generate.mockResolvedValue({ kind: 'name', name: 'Brenir', ancestry: null });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate Name' }));

    await waitFor(() => expect(screen.getByText('Brenir')).toBeInTheDocument());
    expect(mocked.generate).toHaveBeenCalledWith('name');
  });

  it('generates and displays an NPC suggestion', async () => {
    mocked.generate.mockResolvedValue({
      kind: 'npc',
      name: 'Corir',
      role: 'innkeeper',
      motivation: 'wants out of debt',
      quirk: 'hums constantly',
    });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));

    await waitFor(() => expect(screen.getByText(/Corir/)).toBeInTheDocument());
    expect(screen.getByText(/Motivation: wants out of debt/)).toBeInTheDocument();
    expect(screen.getByText(/Quirk: hums constantly/)).toBeInTheDocument();
  });

  it('generates and displays a loot suggestion', async () => {
    mocked.generate.mockResolvedValue({
      kind: 'loot',
      name: 'Premium Bedroll',
      description: 'During downtime, you automatically clear a Stress.',
    });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate Loot' }));

    await waitFor(() => expect(screen.getByText('Premium Bedroll')).toBeInTheDocument());
  });

  it('rerolls by calling generate again for the active kind', async () => {
    mocked.generate
      .mockResolvedValueOnce({ kind: 'name', name: 'First', ancestry: null })
      .mockResolvedValueOnce({ kind: 'name', name: 'Second', ancestry: null });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate Name' }));
    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Reroll' }));
    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
    expect(mocked.generate).toHaveBeenCalledTimes(2);
  });

  it('dismisses the suggestion', async () => {
    mocked.generate.mockResolvedValue({ kind: 'name', name: 'Brenir', ancestry: null });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate Name' }));
    await waitFor(() => expect(screen.getByText('Brenir')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Brenir')).not.toBeInTheDocument();
  });

  it('shows an error message when generation fails', async () => {
    mocked.generate.mockRejectedValue(new ApiError(500, 'Generator unavailable'));
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate Name' }));

    await waitFor(() => expect(screen.getByText('Generator unavailable')).toBeInTheDocument());
  });

  it('keeps a generated NPC to the Library', async () => {
    mocked.generate.mockResolvedValue(npcSuggestion);
    mockedLibrary.createEntity.mockResolvedValue({
      id: 1,
      name: 'Corir',
      summary: 'innkeeper',
      extra: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    await waitFor(() => expect(screen.getByText(/Corir/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));

    await waitFor(() =>
      expect(mockedLibrary.createEntity).toHaveBeenCalledWith(
        'npcs',
        1,
        expect.objectContaining({ name: 'Corir' }),
      ),
    );
    await waitFor(() => expect(screen.getByText('Added to Library')).toBeInTheDocument());
  });

  it('does not offer Keep for name or loot suggestions', async () => {
    mocked.generate.mockResolvedValue({ kind: 'name', name: 'Brenir', ancestry: null });
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate Name' }));
    await waitFor(() => expect(screen.getByText('Brenir')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
  });

  it('shows a hint instead of Keep when no Library world exists', async () => {
    mockedLibrary.listWorlds.mockResolvedValue([]);
    mocked.generate.mockResolvedValue(npcSuggestion);
    render(<QuickGeneratePanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    await waitFor(() => expect(screen.getByText(/Corir/)).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(screen.getByText(/Create a Library world first/)).toBeInTheDocument();
  });
});
