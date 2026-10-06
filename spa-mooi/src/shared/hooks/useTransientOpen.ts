import { useCallback, useEffect, useState } from 'react';

interface TransientOpen {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

/** Open state that closes itself `duration` ms after opening, the way touch tooltips fade on their own. */
export const useTransientOpen = (duration: number): TransientOpen => {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(close, duration);
    return () => window.clearTimeout(timer);
  }, [open, duration, close]);

  return { open, toggle, close };
};
