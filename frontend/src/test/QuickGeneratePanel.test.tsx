import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as generatorsApi from '../api/generators';
import QuickGeneratePanel from '../pages/gm/QuickGeneratePanel';

vi.mock('../api/generators');
const mocked = vi.mocked(generatorsApi);

describe('QuickGeneratePanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
});
