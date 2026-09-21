import { env } from '@/config/env';
import { getAccessToken } from '@/features/auth/lib/accessTokenProvider';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';
import type { SessionEventType } from '@/features/sessions/types/SessionEventType';

export type SessionStreamState = 'open' | 'reconnecting' | 'closed';

interface OpenSessionStreamOptions {
  sessionId: string;
  after: number;
  onEvent: (event: SessionEvent) => void;
  onState: (state: SessionStreamState) => void;
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;

/**
 * A frame's `data:` line carries `seq` and `at` flattened alongside the event-specific fields
 * (`sse_frame` in `mic-sessions/shared/events.py`), so it is unpacked rather than nested under
 * a `data` key on the wire.
 */
const parseFrame = (frame: string): SessionEvent | null => {
  if (frame.length === 0 || frame.startsWith(':')) {
    return null;
  }

  let type: string | null = null;
  let dataLine = '';

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      type = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLine += line.slice(5).trim();
    }
  }

  if (type === null || dataLine.length === 0) {
    return null;
  }

  const { seq, at, ...data } = JSON.parse(dataLine) as { seq: number; at: string; [key: string]: unknown };

  return { seq, at, type: type as SessionEventType, data };
};

/**
 * Opens the live tail of a session's event log with `fetch` + `ReadableStream`, since `EventSource`
 * cannot carry an `Authorization` header. Reconnects with exponential backoff,
 * resuming from the last seen `seq` so replay on the server fills the gap exactly once.
 */
export const openSessionStream = ({ sessionId, after, onEvent, onState }: OpenSessionStreamOptions): (() => void) => {
  let closed = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSeq = after;
  let backoffMs = MIN_BACKOFF_MS;

  const scheduleReconnect = () => {
    if (closed) {
      return;
    }

    onState('reconnecting');
    retryTimer = setTimeout(() => {
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      void connect();
    }, backoffMs);
  };

  const connect = async (): Promise<void> => {
    if (closed) {
      return;
    }

    controller = new AbortController();

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${env.sessionsBaseUrl}/sessions/${sessionId}/events?after=${lastSeq}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (response.status === 404 || response.status === 403) {
        closed = true;
        onEvent({ seq: lastSeq + 1, at: new Date().toISOString(), type: 'session.status',
          data: { status: 'closed', detail: 'This session is no longer available.' } });
        onState('closed');
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`Session stream failed with status ${response.status}`);
      }

      onState('open');
      backoffMs = MIN_BACKOFF_MS;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');

        while (boundary !== -1) {
          const event = parseFrame(buffer.slice(0, boundary));

          buffer = buffer.slice(boundary + 2);

          if (event) {
            lastSeq = event.seq;
            onEvent(event);
          }

          boundary = buffer.indexOf('\n\n');
        }
      }

      throw new Error('Session stream ended');
    } catch (error) {
      if (closed || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }

      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    closed = true;

    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    controller?.abort();
    onState('closed');
  };
};
