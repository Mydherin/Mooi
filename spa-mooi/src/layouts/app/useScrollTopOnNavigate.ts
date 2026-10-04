import { useLayoutEffect, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Screens scroll inside the layout's `main`, not the window, so the router's own scroll handling
 * never sees them: a new screen starts at its top instead of where the previous one was left.
 */
export const useScrollTopOnNavigate = (container: RefObject<HTMLElement | null>): void => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    container.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [container, pathname]);
};
