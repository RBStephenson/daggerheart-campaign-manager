import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from '../hooks/useWebSocket';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('transitions to open when the socket connects', async () => {
    const { result } = renderHook(() => useWebSocket('room1'));
    expect(result.current.status).toBe('connecting');

    act(() => MockWebSocket.instances[0].triggerOpen());
    await waitFor(() => expect(result.current.status).toBe('open'));
  });

  it('dispatches parsed messages to onMessage', async () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket('room1', { onMessage }));
    const socket = MockWebSocket.instances[0];
    act(() => socket.triggerOpen());

    act(() => socket.triggerMessage({ type: 'chat', payload: { text: 'hi' } }));

    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith({ type: 'chat', payload: { text: 'hi' } }),
    );
  });

  it('sends only while the socket is open', () => {
    const { result } = renderHook(() => useWebSocket('room1'));
    const socket = MockWebSocket.instances[0];

    result.current.send({ type: 'ping', payload: {} });
    expect(socket.sent).toHaveLength(0);

    act(() => socket.triggerOpen());
    result.current.send({ type: 'ping', payload: {} });
    expect(socket.sent).toEqual([JSON.stringify({ type: 'ping', payload: {} })]);
  });

  it('reconnects with backoff after the socket closes', async () => {
    vi.useFakeTimers();
    renderHook(() => useWebSocket('room1', { reconnectBaseDelay: 1000 }));
    const first = MockWebSocket.instances[0];
    act(() => first.triggerOpen());

    act(() => first.close());
    expect(MockWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does not connect when room is null', () => {
    renderHook(() => useWebSocket(null));
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
