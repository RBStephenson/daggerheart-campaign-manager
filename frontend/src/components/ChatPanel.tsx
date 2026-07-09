import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { listChatHistory, type ChatMessage } from '../api/chat';
import { useWebSocket, type Envelope } from '../hooks/useWebSocket';

interface ChatPanelProps {
  room: string;
}

export default function ChatPanel({ room }: ChatPanelProps) {
  const [disabled, setDisabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listChatHistory(room)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          if (!cancelled) setDisabled(true);
        } else {
          console.error('Failed to load chat history', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [room]);

  function handleMessage(envelope: Envelope) {
    if (envelope.type !== 'chat') return;
    const message = envelope.payload as unknown as ChatMessage;
    setMessages((prev) => [...prev, message]);
    setOpen((isOpen) => {
      if (!isOpen) setUnread((n) => n + 1);
      return isOpen;
    });
  }

  const { send } = useWebSocket(disabled ? null : room, { onMessage: handleMessage });

  useEffect(() => {
    if (open) {
      setUnread(0);
      listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
    }
  }, [open, messages]);

  function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const body = String(form.get('body') ?? '').trim();
    if (!body) return;
    send({ type: 'chat', payload: { body } });
    formEl.reset();
  }

  if (disabled) return null;

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-slate-700"
      >
        <span>Chat</span>
        {unread > 0 && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            {unread}
          </span>
        )}
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-200 p-3">
          <div ref={listRef} className="mb-2 max-h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {messages.map((m) => (
                  <li key={m.id} className="text-sm text-slate-700">
                    <span className="font-semibold">{m.author_username}:</span>{' '}
                    <span className="break-words">{m.body}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              name="body"
              placeholder="Say something…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
