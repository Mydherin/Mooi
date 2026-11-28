import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { consumeViewTransition } from '@/app/navigation/viewTransitionFlag';
import { REDUCED_MOTION_QUERY } from '@/shared/hooks/mediaQueries';

/**
 * A new screen fades up into place when no view transition animated it (Back, browsers without
 * the API). Driven by the Web Animations API on the existing container, so nothing remounts and
 * only opacity and transform change, which the compositor handles without layout or paint.
 */
export const useRouteFadeFallback = (container: RefObject<HTMLElement | null>): void => {
  const { pathname } = useLocation();
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const element = container.current;
    if (consumeViewTransition() || !element || window.matchMedia(REDUCED_MOTION_QUERY).matches || typeof element.animate !== 'function') return;
    const animation = element.animate(
      [{ opacity: 0.001, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    return () => animation.cancel();
  }, [container, pathname]);
};
