import { useCallback, useEffect, useRef, useState } from 'react';

export interface Envelope {
  type: string;
  payload: Record<string, unknown>;
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

interface UseWebSocketOptions {
  onMessage?: (envelope: Envelope) => void;
  /** Base delay for exponential backoff reconnects, in ms. */
  reconnectBaseDelay?: number;
  /** Cap on the backoff delay, in ms. */
  reconnectMaxDelay?: number;
}

function resolveWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

/** Room-scoped WebSocket connection with typed message dispatch and auto-reconnect. */
export function useWebSocket(room: string | null, options: UseWebSocketOptions = {}) {
  const { onMessage, reconnectBaseDelay = 1000, reconnectMaxDelay = 30_000 } = options;
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByClient = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((envelope: Envelope) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(envelope));
    }
  }, []);

  useEffect(() => {
    if (!room) return;
    closedByClient.current = false;

    function connect() {
      setStatus('connecting');
      const socket = new WebSocket(resolveWsUrl(`/ws/${room}`));
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus('open');
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const envelope = JSON.parse(event.data) as Envelope;
          onMessageRef.current?.(envelope);
        } catch (err) {
          console.error('Received malformed WebSocket message', err);
        }
      };

      socket.onclose = () => {
        setStatus('closed');
        if (closedByClient.current) return;
        const delay = Math.min(
          reconnectBaseDelay * 2 ** attemptRef.current,
          reconnectMaxDelay,
        );
        attemptRef.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      closedByClient.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [room, reconnectBaseDelay, reconnectMaxDelay]);

  return { status, send };
}
