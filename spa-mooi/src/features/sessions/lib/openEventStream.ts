import { env } from '@/config/env';
import { getAccessToken } from '@/features/auth/lib/accessTokenProvider';

export type EventStreamState = 'open' | 'reconnecting' | 'closed';

export interface StreamFrame {
  seq: number;
  at: string;
  type: string;
  data: Record<string, unknown>;
}

interface OpenEventStreamOptions {
  /** mic-sessions path; `after` is appended so a reconnect resumes from the last seen `seq`. */
  path: string;
  after: number;
  onFrame: (frame: StreamFrame) => void;
  onState: (state: EventStreamState) => void;
  /** The resource answered 404/403: the stream stops for good. */
  onGone?: (lastSeq: number) => void;
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;

/**
 * A frame's `data:` line carries `seq` and `at` flattened alongside the event-specific fields
 * (`sse_frame` in `mic-sessions/shared/events.py`), so it is unpacked rather than nested under
 * a `data` key on the wire.
 */
const parseFrame = (frame: string): StreamFrame | null => {
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

  return { seq, at, type, data };
};

/**
 * Opens a mic-sessions SSE stream with `fetch` + `ReadableStream`, since `EventSource` cannot
 * carry an `Authorization` header. Reconnects with exponential backoff, resuming from the last
 * seen `seq` so replay on the server fills the gap exactly once.
 */
export const openEventStream = ({ path, after, onFrame, onState, onGone }: OpenEventStreamOptions): (() => void) => {
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

      const separator = path.includes('?') ? '&' : '?';
      const response = await fetch(`${env.sessionsBaseUrl}${path}${separator}after=${lastSeq}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (response.status === 404 || response.status === 403) {
        closed = true;
        onGone?.(lastSeq);
        onState('closed');
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`Event stream failed with status ${response.status}`);
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
          const frame = parseFrame(buffer.slice(0, boundary));

          buffer = buffer.slice(boundary + 2);

          if (frame) {
            lastSeq = frame.seq;
            onFrame(frame);
          }

          boundary = buffer.indexOf('\n\n');
        }
      }

      throw new Error('Event stream ended');
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
