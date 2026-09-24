import { useEffect, useState } from 'react';
import { sendSessionActivity } from '@/features/sessions/api/sessionsApi';

export const usePreviewActivity = (sessionId: string, enabled: boolean) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let request: AbortController | undefined;
    let disposed = false;
    let lastSent = -Infinity;
    const active = () => document.visibilityState === 'visible' && document.hasFocus();
    const ping = async () => {
      if (!active() || request || performance.now() - lastSent < 60_000) return;
      const controller = new AbortController();
      request = controller;
      lastSent = performance.now();
      try {
        await sendSessionActivity(sessionId, controller.signal);
        if (!disposed && !controller.signal.aborted) setFailed(false);
      } catch {
        if (!disposed && !controller.signal.aborted) setFailed(true);
      } finally {
        if (request === controller) request = undefined;
      }
    };
    const update = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (active()) {
        void ping();
        timer = setInterval(() => void ping(), 60_000);
      } else {
        request?.abort();
      }
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    update();
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      request?.abort();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, [sessionId, enabled]);
  return failed;
};
