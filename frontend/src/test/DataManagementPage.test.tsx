import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as databaseApi from '../api/database';
import DataManagementPage from '../pages/host/DataManagementPage';

vi.mock('../api/database');
const mocked = vi.mocked(databaseApi.database);

describe('DataManagementPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('downloads a backup', async () => {
    mocked.backup.mockResolvedValue(undefined);
    render(<DataManagementPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Download Backup' }));
    await waitFor(() => expect(mocked.backup).toHaveBeenCalled());
    expect(await screen.findByText('Backup downloaded')).toBeInTheDocument();
  });

  it('runs a health check and shows the result', async () => {
    mocked.health.mockResolvedValue({ ok: true, status: 'healthy', detail: 'ok' });
    render(<DataManagementPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Check Health' }));
    expect(await screen.findByText(/Healthy/)).toBeInTheDocument();
  });

  it('disables repair until a health check reports corruption', async () => {
    mocked.health.mockResolvedValue({ ok: false, status: 'corrupt', detail: 'database disk image is malformed' });
    render(<DataManagementPage />);
    expect(screen.getByRole('button', { name: 'Repair Database' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Check Health' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Repair Database' })).toBeEnabled());
  });

  it('requires typing ACKNOWLEDGED before reset proceeds', async () => {
    mocked.reset.mockResolvedValue({ ok: true, snapshot: '/data/backups/pre_reset.db' });
    render(<DataManagementPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
    const confirmButton = screen.getByRole('button', { name: 'Delete Everything' });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('ACKNOWLEDGED'), 'ACKNOWLEDGED');
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);
    await waitFor(() => expect(mocked.reset).toHaveBeenCalled());
  });

  it('shows the restore error inline without closing the confirm dialog', async () => {
    mocked.restore.mockRejectedValue(new ApiError(400, 'Invalid backup file'));
    render(<DataManagementPage />);

    const file = new File(['data'], 'backup.db', { type: 'application/octet-stream' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await userEvent.type(screen.getByPlaceholderText('ACKNOWLEDGED'), 'ACKNOWLEDGED');
    await userEvent.click(screen.getByRole('button', { name: 'Overwrite Database' }));

    expect(await screen.findByText('Invalid backup file')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Overwrite Database|Restoring/ })).toBeInTheDocument();
  });
});
