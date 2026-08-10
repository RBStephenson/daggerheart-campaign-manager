import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as authContext from '../context/AuthContext';
import HelpPage from '../pages/help/HelpPage';

vi.mock('../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AuthContext')>();
  return { ...actual, useAuth: vi.fn() };
});
const mockedUseAuth = vi.mocked(authContext.useAuth);

function mockUser(role: 'gm' | 'player') {
  mockedUseAuth.mockReturnValue({
    user: { id: 1, username: 'test-user', role },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
}

describe('HelpPage', () => {
  it('shows the GM guide for a gm user', () => {
    mockUser('gm');
    render(<HelpPage />);
    expect(screen.getByText('2. Create a campaign')).toBeInTheDocument();
    expect(screen.queryByText('3. Create a character')).not.toBeInTheDocument();
  });

  it('shows the Player guide for a player user', () => {
    mockUser('player');
    render(<HelpPage />);
    expect(screen.getByText('3. Create a character')).toBeInTheDocument();
    expect(screen.queryByText('2. Create a campaign')).not.toBeInTheDocument();
  });

  it('sections start open and can be collapsed', async () => {
    mockUser('gm');
    render(<HelpPage />);
    expect(screen.getByText(/Every feature in this app ships off by default/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /1\. Turn on the features you want/ }));
    expect(
      screen.queryByText(/Every feature in this app ships off by default/),
    ).not.toBeInTheDocument();
  });
});
