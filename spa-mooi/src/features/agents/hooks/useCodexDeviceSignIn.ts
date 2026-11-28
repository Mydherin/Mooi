import { useEffect, useRef, useState } from 'react';
import { cancelCodexAuthorization, pollCodexAuthorization, startCodexAuthorization } from '@/features/agents/api/codexApi';
import type { CodexAuthorization } from '@/features/agents/types/CodexAuthorization';

const POLL_MS = 2000;
const ENDED = ['failed', 'expired', 'cancelled'];

/**
 * One Codex device-code attempt for the chosen account title: started on mount, followed until the
 * account is linked, and cancelled on the server when the view goes away before that.
 */
export const useCodexDeviceSignIn = (name: string, connectionId: string | undefined, onConnected: () => void) => {
  const [attempt, setAttempt] = useState<CodexAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connected = useRef(onConnected);
  useEffect(() => { connected.current = onConnected; });
  const initial = useRef({ name: name.trim(), connectionId });

  useEffect(() => {
    let disposed = false;
    let current: CodexAuthorization | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (cause: unknown) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : 'Could not link Codex. Try again.');
    };
    const poll = async () => {
      if (!current || disposed) return;
      try {
        const status = await pollCodexAuthorization(current.id);
        if (disposed) return;
        if (status === 'connected') {
          current = null;
          connected.current();
        } else if (ENDED.includes(status)) {
          setError('The sign-in could not be completed. Close this window and try again.');
        } else timer = setTimeout(() => void poll(), POLL_MS);
      } catch (cause) { fail(cause); }
    };
    // Deferred one tick so a StrictMode double mount never opens two attempts.
    const startTimer = setTimeout(() => void startCodexAuthorization(initial.current.name, initial.current.connectionId).then((value) => {
      current = value;
      if (disposed) { void cancelCodexAuthorization(value.id).catch(() => {}); return; }
      setAttempt(value);
      void poll();
    }).catch(fail), 0);
    return () => {
      disposed = true;
      clearTimeout(startTimer);
      clearTimeout(timer);
      if (current) void cancelCodexAuthorization(current.id).catch(() => {});
    };
  }, []);

  return { attempt, error };
};
