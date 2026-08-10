import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AppSettingsProvider } from '../context/AppSettingsContext';
import { AuthProvider } from '../context/AuthContext';

type MockUser = { id: number; username: string; role: 'gm' | 'player' } | null;

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
          json: () => Promise.resolve({ id: 1, username: 'alice', role: 'gm' }),
        });
      }
      if (url === '/api/auth/register' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 2, username: 'bob', role: 'player' }),
        });
      }
      if (url.startsWith('/api/campaigns') || url.startsWith('/api/player')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
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

  it('redirects / to /login', async () => {
    renderApp('/', null);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument(),
    );
  });

  it('redirects unauthenticated users to /login', async () => {
    renderApp('/host', null);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument(),
    );
  });

  it('lets a gm user reach /host', async () => {
    renderApp('/host', { id: 1, username: 'alice', role: 'gm' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument(),
    );
  });

  it('lets a gm user reach /gm', async () => {
    renderApp('/gm', { id: 1, username: 'alice', role: 'gm' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Gamemaster' })).toBeInTheDocument(),
    );
  });

  it('denies a gm user access to /player', async () => {
    renderApp('/player', { id: 1, username: 'alice', role: 'gm' });
    await waitFor(() =>
      expect(screen.getByText(/don't have access/)).toBeInTheDocument(),
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

  it('lets a gm reach /help with the GM guide', async () => {
    renderApp('/help', { id: 1, username: 'alice', role: 'gm' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument());
    expect(screen.getByText(/running a campaign/)).toBeInTheDocument();
  });

  it('lets a player reach /help with the Player guide', async () => {
    renderApp('/help', { id: 2, username: 'bob', role: 'player' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument());
    expect(screen.getByText(/getting set up and playing/)).toBeInTheDocument();
  });

  it('renders settings under /host/settings for a gm', async () => {
    renderApp('/host/settings', { id: 1, username: 'alice', role: 'gm' });
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
      expect(screen.getByRole('heading', { name: 'Gamemaster' })).toBeInTheDocument(),
    );
  });

  it('shows an error on /register with no token in the URL', async () => {
    renderApp('/register', null);
    await waitFor(() =>
      expect(screen.getByText(/missing an invite token/i)).toBeInTheDocument(),
    );
  });

  it('registers with a valid token and lands in the player area', async () => {
    renderApp('/register?token=abc123', null);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText('Username'), 'bob');
    await userEvent.type(screen.getByLabelText('Password'), 'a-real-password');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Player' })).toBeInTheDocument(),
    );
  });
});
