import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AppSettingsProvider } from '../context/AppSettingsContext';

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  it('renders home page', async () => {
    renderApp('/');
    expect(screen.getByText('Daggerheart Campaign Manager')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/settings', expect.anything()));
  });

  it('renders settings page with empty state', async () => {
    renderApp('/settings');
    await waitFor(() =>
      expect(screen.getByText(/No settings yet/)).toBeInTheDocument(),
    );
  });

  it('falls back to defaults when settings fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp('/settings');
    await waitFor(() =>
      expect(screen.getByText(/No settings yet/)).toBeInTheDocument(),
    );
    expect(consoleError).toHaveBeenCalled();
  });
});
