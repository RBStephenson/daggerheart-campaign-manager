import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../api/client';
import * as aiApi from '../api/ai';
import AiDraftField from '../components/ui/AiDraftField';
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
const mockedUseAuth = vi.mocked(authContext.useAuth);
const mockedGenerateAiText = vi.mocked(aiApi.generateAiText);

function renderField(enabled: boolean) {
  mockedApiGet.mockResolvedValue({ ai_text_enabled: enabled, ai_text_api: enabled ? 1 : null });
  return render(
    <AppSettingsProvider>
      <form>
        <input name="name" defaultValue="Gravemind Ilthys" />
        <AiDraftField name="summary" label="Summary" entityType="npc" className="input" />
      </form>
    </AppSettingsProvider>,
  );
}

describe('AiDraftField', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'gm', role: 'gm' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('hides the Generate affordance entirely when ai_text_enabled is off', async () => {
    renderField(false);
    await waitFor(() => expect(mockedApiGet).toHaveBeenCalled());
    expect(screen.queryByText(/Generate summary/)).not.toBeInTheDocument();
  });

  it('shows Generate, fetches a draft, and only applies it on Accept', async () => {
    mockedGenerateAiText.mockResolvedValue({ draft: 'A weary sellsword with a grudge.' });
    renderField(true);

    const generateToggle = await screen.findByText(/Generate summary/);
    await userEvent.click(generateToggle);
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() =>
      expect(mockedGenerateAiText).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'npc',
          existing_fields: { name: 'Gravemind Ilthys' },
        }),
      ),
    );

    const draftText = await screen.findByText('A weary sellsword with a grudge.');
    expect(draftText).toBeInTheDocument();
    const textarea = document.querySelector('textarea[name="summary"]') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(textarea.value).toBe('A weary sellsword with a grudge.');
    expect(screen.queryByText('A weary sellsword with a grudge.')).not.toBeInTheDocument();
  });

  it('discarding a draft leaves the field untouched', async () => {
    mockedGenerateAiText.mockResolvedValue({ draft: 'Some draft text' });
    renderField(true);

    await userEvent.click(await screen.findByText(/Generate summary/));
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByText('Some draft text');

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByText('Some draft text')).not.toBeInTheDocument();
    const textarea = document.querySelector('textarea[name="summary"]') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });
});
