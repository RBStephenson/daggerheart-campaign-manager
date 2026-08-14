import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../api/client';
import * as aiApi from '../api/ai';
import HostSettingsPage from '../pages/host/HostSettingsPage';
import { AppSettingsProvider } from '../context/AppSettingsContext';
import * as authContext from '../context/AuthContext';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof client>();
  return { ...actual, apiGet: vi.fn(), apiPut: vi.fn() };
});
vi.mock('../api/ai');
vi.mock('../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AuthContext')>();
  return { ...actual, useAuth: vi.fn() };
});
const mockedApiGet = vi.mocked(client.apiGet);
const mockedApiPut = vi.mocked(client.apiPut);
const mockedUseAuth = vi.mocked(authContext.useAuth);
const mockedListAiApiConfigs = vi.mocked(aiApi.listAiApiConfigs);

describe('HostSettingsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedListAiApiConfigs.mockResolvedValue([]);
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'gm', role: 'gm' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('renders a checkbox per boolean setting reflecting its current value', async () => {
    mockedApiGet.mockResolvedValue({ data_management_enabled: false, chat_enabled: true });
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText('data_management_enabled')).not.toBeChecked());
    expect(screen.getByLabelText('chat_enabled')).toBeChecked();
  });

  it('toggles a flag via PUT /api/settings', async () => {
    mockedApiGet.mockResolvedValue({ data_management_enabled: false });
    mockedApiPut.mockResolvedValue({ data_management_enabled: true });
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    const checkbox = await screen.findByLabelText('data_management_enabled');
    await userEvent.click(checkbox);

    await waitFor(() =>
      expect(mockedApiPut).toHaveBeenCalledWith('/api/settings', { data_management_enabled: true }),
    );
  });
});
