import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'scroll-positions';
const MAX_ENTRIES = 50;
/** Frames to keep trying while a returning screen grows back to the saved height (lists render from stores). */
const RESTORE_FRAMES = 30;

const load = (): Map<string, number> => {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as [string, number][]);
  } catch {
    return new Map();
  }
};

/**
 * Screens scroll inside the layout's `main`, not the window, so the router's own restoration never
 * sees them. A new screen starts at its top; going back (or forward) returns to where it was left,
 * per history entry, across reloads of the tab. Same-screen updates (a tab in the query string)
 * keep the position.
 */
export const useScrollRestoration = (container: RefObject<HTMLElement | null>): void => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef<Map<string, number> | null>(null);
  const previous = useRef<{ key: string; pathname: string } | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const key = location.key;
    const onScroll = () => {
      positions.current ??= load();
      positions.current.set(key, element.scrollTop);
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [container, location.key]);

  useEffect(() => {
    const persist = () => {
      const entries = [...(positions.current ?? load())].slice(-MAX_ENTRIES);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    };
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, []);

  useLayoutEffect(() => {
    const element = container.current;
    const last = previous.current;
    previous.current = { key: location.key, pathname: location.pathname };
    if (!element || (last && last.pathname === location.pathname)) return;
    positions.current ??= load();
    const saved = navigationType === 'POP' ? positions.current.get(location.key) : undefined;
    if (saved === undefined) {
      element.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      element.scrollTo({ top: saved, behavior: 'instant' });
      attempts += 1;
      if (Math.abs(element.scrollTop - saved) > 1 && attempts < RESTORE_FRAMES) frame = window.requestAnimationFrame(restore);
    };
    restore();
    return () => window.cancelAnimationFrame(frame);
  }, [container, location.key, location.pathname, navigationType]);
};
