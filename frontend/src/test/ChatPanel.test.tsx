import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as chatApi from '../api/chat';
import type { Envelope } from '../hooks/useWebSocket';
import ChatPanel from '../components/ChatPanel';

vi.mock('../api/chat');
const mockedChatApi = vi.mocked(chatApi);

const mockSend = vi.fn();
let capturedOnMessage: ((envelope: Envelope) => void) | undefined;

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: (_room: string | null, opts?: { onMessage?: (e: Envelope) => void }) => {
    capturedOnMessage = opts?.onMessage;
    return { status: 'open', send: mockSend };
  },
}));

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnMessage = undefined;
  });

  it('renders nothing when chat is disabled', async () => {
    mockedChatApi.listChatHistory.mockRejectedValue(new ApiError(404, 'not found'));
    const { container } = render(<ChatPanel room="session-1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the toggle collapsed by default', async () => {
    mockedChatApi.listChatHistory.mockResolvedValue([]);
    render(<ChatPanel room="session-1" />);
    await waitFor(() => expect(screen.getByText('Chat')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Say something…')).not.toBeInTheDocument();
  });

  it('loads and displays history on open', async () => {
    mockedChatApi.listChatHistory.mockResolvedValue([
      {
        id: 1,
        room: 'session-1',
        author_user_id: 1,
        author_username: 'alice',
        body: 'hello there',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render(<ChatPanel room="session-1" />);
    await waitFor(() => expect(screen.getByText('Chat')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Chat'));
    await waitFor(() => expect(screen.getByText('hello there')).toBeInTheDocument());
    expect(screen.getByText('alice:')).toBeInTheDocument();
  });

  it('sends a message and clears the input', async () => {
    mockedChatApi.listChatHistory.mockResolvedValue([]);
    render(<ChatPanel room="session-1" />);
    await userEvent.click(await screen.findByText('Chat'));

    const input = screen.getByPlaceholderText('Say something…') as HTMLInputElement;
    await userEvent.type(input, 'hi everyone');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(mockSend).toHaveBeenCalledWith({ type: 'chat', payload: { body: 'hi everyone' } });
    expect(input.value).toBe('');
  });

  it('shows an unread badge for messages received while closed', async () => {
    mockedChatApi.listChatHistory.mockResolvedValue([]);
    render(<ChatPanel room="session-1" />);
    await waitFor(() => expect(screen.getByText('Chat')).toBeInTheDocument());

    capturedOnMessage?.({
      type: 'chat',
      payload: {
        id: 2,
        room: 'session-1',
        author_user_id: 2,
        author_username: 'bob',
        body: 'yo',
        created_at: '2026-01-01T00:01:00Z',
      },
    });

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Chat'));
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
  });
});
