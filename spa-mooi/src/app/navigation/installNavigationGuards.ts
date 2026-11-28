import type { RouterNavigateOptions, To } from 'react-router-dom';
import { markViewTransition } from '@/app/navigation/viewTransitionFlag';
import { releaseOverlaysForNavigation } from '@/shared/components/overlays/stack/overlayStack';
import { REDUCED_MOTION_QUERY } from '@/shared/hooks/mediaQueries';

type Navigate = (to: To | number | null, opts?: RouterNavigateOptions) => Promise<void>;

interface NavigableRouter {
  navigate: { (to: number): Promise<void>; (to: To | null, opts?: RouterNavigateOptions): Promise<void> };
  state: { location: { pathname: string } };
}

const supportsViewTransitions = (): boolean => typeof document.startViewTransition === 'function';

const targetPathname = (to: To | null, current: string): string => {
  if (to === null) return current;
  if (typeof to === 'string') return new URL(to, `http://app${current.endsWith('/') ? current : `${current}/`}`).pathname;
  return to.pathname ?? current;
};

/**
 * Every navigation (links, `useNavigate`, redirects) passes through here first:
 * 1. Open overlays give their history entries back, so a link inside a sheet never leaves a dead
 *    entry behind the new page (see `releaseOverlaysForNavigation`); overlays still mounted after
 *    the navigation close.
 * 2. A move to another screen runs inside a view transition (cross-fade of the content panel),
 *    unless the user prefers reduced motion or the browser lacks the API. Same-screen updates
 *    (a tab in the query string) never animate.
 */
export const installNavigationGuards = (router: NavigableRouter): void => {
  const navigate = router.navigate.bind(router) as Navigate;

  const guarded: Navigate = async (to, opts) => {
    const dismissRemaining = await releaseOverlaysForNavigation();
    if (typeof to === 'number') {
      await navigate(to);
    } else {
      const current = router.state.location.pathname;
      const animate = opts?.viewTransition ?? (supportsViewTransitions() && !window.matchMedia(REDUCED_MOTION_QUERY).matches
        && targetPathname(to, current) !== current);
      if (animate) markViewTransition();
      await navigate(to, { ...opts, viewTransition: animate });
    }
    dismissRemaining();
  };
  router.navigate = guarded as NavigableRouter['navigate'];
};
