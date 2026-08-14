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
const mockedCreateAiApiConfig = vi.mocked(aiApi.createAiApiConfig);
const mockedDeleteAiApiConfig = vi.mocked(aiApi.deleteAiApiConfig);

const CONFIG = {
  id: 1,
  name: 'Claude',
  api_type: 'anthropic' as const,
  url: null,
  model: 'claude-sonnet-5',
  effort: null,
  request_timeout: 10,
  batch_size: null,
  reasoning_enabled: false,
  key_set: true,
  key_hint: 'sk-...ab12',
  created_at: '2026-08-14T00:00:00Z',
};

describe('AiSettingsSection (via HostSettingsPage)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'gm', role: 'gm' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    mockedListAiApiConfigs.mockResolvedValue([]);
  });

  it('renders the ai_text_enabled toggle from the generic settings list', async () => {
    mockedApiGet.mockResolvedValue({ ai_text_enabled: false, ai_text_api: null });
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    expect(await screen.findByLabelText('ai_text_enabled')).not.toBeChecked();
  });

  it('does not render ai_text_api as a raw settings row', async () => {
    mockedApiGet.mockResolvedValue({ ai_text_enabled: false, ai_text_api: 1 });
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    await screen.findByLabelText('ai_text_enabled');
    expect(screen.queryByText('ai_text_api')).not.toBeInTheDocument();
  });

  it('lists existing AI API configs', async () => {
    mockedApiGet.mockResolvedValue({ ai_text_enabled: false, ai_text_api: null });
    mockedListAiApiConfigs.mockResolvedValue([CONFIG]);
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Claude' })).toBeInTheDocument();
    expect(screen.getByText(/key set \(sk-\.\.\.ab12\)/)).toBeInTheDocument();
  });

  it('creates a new config and reloads the list', async () => {
    mockedApiGet.mockResolvedValue({ ai_text_enabled: false, ai_text_api: null });
    mockedCreateAiApiConfig.mockResolvedValue(CONFIG);
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    await screen.findByText('Add AI API config');
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Claude');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mockedCreateAiApiConfig).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Claude', api_type: 'anthropic' }),
      ),
    );
  });

  it('selecting an active config updates ai_text_api via PUT /api/settings', async () => {
    mockedApiGet.mockResolvedValue({ ai_text_enabled: true, ai_text_api: null });
    mockedApiPut.mockResolvedValue({ ai_text_enabled: true, ai_text_api: 1 });
    mockedListAiApiConfigs.mockResolvedValue([CONFIG]);
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    const select = await screen.findByLabelText('Active config');
    await userEvent.selectOptions(select, 'Claude');

    await waitFor(() =>
      expect(mockedApiPut).toHaveBeenCalledWith('/api/settings', { ai_text_api: 1 }),
    );
  });

  it('deleting the currently-selected config clears ai_text_api', async () => {
    mockedApiGet.mockResolvedValue({ ai_text_enabled: true, ai_text_api: 1 });
    mockedApiPut.mockResolvedValue({ ai_text_enabled: true, ai_text_api: null });
    mockedListAiApiConfigs.mockResolvedValue([CONFIG]);
    mockedDeleteAiApiConfig.mockResolvedValue(undefined);
    render(
      <AppSettingsProvider>
        <HostSettingsPage />
      </AppSettingsProvider>,
    );

    await screen.findByRole('heading', { name: 'Claude' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(mockedApiPut).toHaveBeenCalledWith('/api/settings', { ai_text_api: null }),
    );
  });
});
