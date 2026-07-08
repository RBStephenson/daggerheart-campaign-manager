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

  it('redirects root to /host', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument();
  });

  it('renders the gamemaster area', () => {
    renderApp('/gm');
    expect(screen.getByRole('heading', { name: 'Gamemaster' })).toBeInTheDocument();
  });

  it('renders the player area', () => {
    renderApp('/player');
    expect(screen.getByRole('heading', { name: 'Player' })).toBeInTheDocument();
  });

  it('renders the login page', () => {
    renderApp('/login');
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('renders settings under /host/settings with empty state', async () => {
    renderApp('/host/settings');
    await waitFor(() => expect(screen.getByText(/No settings yet/)).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/settings', expect.anything());
  });

  it('falls back to defaults when settings fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp('/host/settings');
    await waitFor(() => expect(screen.getByText(/No settings yet/)).toBeInTheDocument());
    expect(consoleError).toHaveBeenCalled();
  });
});
