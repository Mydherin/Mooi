import { useEffect, useState } from 'react';
import { REDUCED_MOTION_QUERY } from '@/shared/hooks/mediaQueries';

export type PresenceState = 'open' | 'closed';

const reducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * Keeps an overlay mounted for its exit animation: `state` turns `closed` at once (the CSS exit
 * keyframes key off `data-state`), and `mounted` turns false once `exitMs` have passed.
 */
export const usePresence = (open: boolean, exitMs = 220): { mounted: boolean; state: PresenceState } => {
  const [previous, setPrevious] = useState(open);
  const [exiting, setExiting] = useState(false);

  if (previous !== open) {
    setPrevious(open);
    setExiting(!open);
  }

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => setExiting(false), reducedMotion() ? 0 : exitMs);
    return () => window.clearTimeout(timer);
  }, [exiting, exitMs]);

  return { mounted: open || exiting, state: open ? 'open' : 'closed' };
};
