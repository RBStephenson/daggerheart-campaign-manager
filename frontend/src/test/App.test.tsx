import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AppSettingsProvider } from '../context/AppSettingsContext';
import { AuthProvider } from '../context/AuthContext';

type MockUser = { id: number; username: string; role: 'host' | 'gm' | 'player' } | null;

function mockFetch(currentUser: MockUser) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentUser) });
      }
      if (url === '/api/auth/login' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 1, username: 'alice', role: 'host' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }),
  );
}

function renderApp(route: string, currentUser: MockUser) {
  mockFetch(currentUser);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <AppSettingsProvider>
          <App />
        </AppSettingsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users to /login', async () => {
    renderApp('/host', null);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument(),
    );
  });

  it('lets a host user reach /host', async () => {
    renderApp('/host', { id: 1, username: 'alice', role: 'host' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument(),
    );
  });

  it('denies a player access to /host', async () => {
    renderApp('/host', { id: 2, username: 'bob', role: 'player' });
    await waitFor(() =>
      expect(screen.getByText(/don't have access/)).toBeInTheDocument(),
    );
  });

  it('lets a player reach /player', async () => {
    renderApp('/player', { id: 2, username: 'bob', role: 'player' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Player' })).toBeInTheDocument(),
    );
  });

  it('renders settings under /host/settings for a host', async () => {
    renderApp('/host/settings', { id: 1, username: 'alice', role: 'host' });
    await waitFor(() => expect(screen.getByText(/No settings yet/)).toBeInTheDocument());
  });

  it('logs in and redirects to the user role area', async () => {
    renderApp('/login', null);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText('Username'), 'alice');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument(),
    );
  });
});
