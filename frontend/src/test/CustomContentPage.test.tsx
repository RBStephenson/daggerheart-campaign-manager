import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as customContentApi from '../api/customContent';
import CustomContentPage from '../pages/host/CustomContentPage';

vi.mock('../api/customContent', async () => {
  const actual = await vi.importActual<typeof customContentApi>('../api/customContent');
  return {
    ...actual,
    listCustomEntities: vi.fn(),
    createCustomEntity: vi.fn(),
    updateCustomEntity: vi.fn(),
    deleteCustomEntity: vi.fn(),
  };
});

const mocked = vi.mocked(customContentApi);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/host/custom-content" element={<CustomContentPage />} />
        <Route path="/host/custom-content/:segment" element={<CustomContentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CustomContentPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listCustomEntities.mockResolvedValue([]);
  });

  it('redirects to the first segment when none is given', async () => {
    renderAt('/host/custom-content');
    expect(await screen.findByRole('heading', { name: 'Add Class' })).toBeInTheDocument();
  });

  it('lists entities for the selected segment', async () => {
    mocked.listCustomEntities.mockResolvedValue([
      {
        id: 1,
        name: 'Sunfang',
        trait: 'Finesse',
        range: 'Melee',
        damage: 'd8+3',
        burden: 'One-Handed',
        is_magic: true,
        feature: null,
        created_at: '2026-08-13T00:00:00Z',
      },
    ]);
    renderAt('/host/custom-content/weapons');
    expect(await screen.findByText('Sunfang')).toBeInTheDocument();
    expect(mocked.listCustomEntities).toHaveBeenCalledWith('weapons');
  });

  it('creates a new entity from the form', async () => {
    mocked.createCustomEntity.mockResolvedValue({
      id: 2,
      name: 'Duskkin',
      features_json: '[]',
      created_at: '2026-08-13T00:00:00Z',
    });
    renderAt('/host/custom-content/ancestries');

    await userEvent.type(screen.getByPlaceholderText('Name'), 'Duskkin');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocked.createCustomEntity).toHaveBeenCalledWith('ancestries', {
        name: 'Duskkin',
        features_json: '[]',
      }),
    );
  });

  it('edits an existing entity', async () => {
    mocked.listCustomEntities.mockResolvedValue([
      { id: 3, name: 'Old Name', features_json: '[]', created_at: '2026-08-13T00:00:00Z' },
    ]);
    mocked.updateCustomEntity.mockResolvedValue({
      id: 3,
      name: 'New Name',
      features_json: '[]',
      created_at: '2026-08-13T00:00:00Z',
    });
    renderAt('/host/custom-content/ancestries');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const nameInputs = screen.getAllByDisplayValue('Old Name');
    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'New Name');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocked.updateCustomEntity).toHaveBeenCalledWith(
        'ancestries',
        3,
        expect.objectContaining({ name: 'New Name' }),
      ),
    );
  });

  it('deletes an entity', async () => {
    mocked.listCustomEntities.mockResolvedValue([
      { id: 4, name: 'Gone Soon', features_json: '[]', created_at: '2026-08-13T00:00:00Z' },
    ]);
    mocked.deleteCustomEntity.mockResolvedValue(undefined);
    renderAt('/host/custom-content/ancestries');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocked.deleteCustomEntity).toHaveBeenCalledWith('ancestries', 4));
  });
});
