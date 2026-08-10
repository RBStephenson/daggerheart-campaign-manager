import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as authApi from '../api/auth';
import InvitePlayerPanel from '../pages/gm/InvitePlayerPanel';

vi.mock('../api/auth');
const mocked = vi.mocked(authApi);

describe('InvitePlayerPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('generates and displays an invite link', async () => {
    mocked.createInvite.mockResolvedValue({ token: 'abc123', role: 'player' });
    render(<InvitePlayerPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate invite link' }));

    await waitFor(() => expect(mocked.createInvite).toHaveBeenCalledWith('player'));
    expect(screen.getByLabelText('Invite link')).toHaveValue(
      `${window.location.origin}/register?token=abc123`,
    );
  });

  it('copies the link to the clipboard', async () => {
    mocked.createInvite.mockResolvedValue({ token: 'abc123', role: 'player' });
    render(<InvitePlayerPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate invite link' }));
    await waitFor(() => expect(screen.getByLabelText('Invite link')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/register?token=abc123`,
      ),
    );
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('shows an error when generation fails', async () => {
    mocked.createInvite.mockRejectedValue(new ApiError(403, 'Forbidden'));
    render(<InvitePlayerPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate invite link' }));
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument());
  });
});
