import { useEffect } from 'react';
import { TOUCH_QUERY } from '@/shared/hooks/mediaQueries';

/** Where a long press would open the browser's link/image menu instead of acting like an app. */
const CONTROL_SELECTOR = 'a, button, img, svg, [role="button"], [role="tab"], [role^="menuitem"], [role="option"], [role="link"]';

/**
 * Removes the browser-only gestures an installed app should not have: pinch zoom on iOS (which
 * ignores `user-scalable=no`) and the long-press context menu on links and controls (Android
 * Chrome). Text stays selectable, and nothing changes for mouse users.
 */
export const useNativeTouchGuards = (): void => {
  useEffect(() => {
    const touch = window.matchMedia(TOUCH_QUERY);

    const blockGesture = (event: Event) => event.preventDefault();
    const blockMenu = (event: MouseEvent) => {
      if (!touch.matches || !(event.target instanceof Element)) return;
      if (event.target.closest(CONTROL_SELECTOR)) event.preventDefault();
    };

    document.addEventListener('gesturestart', blockGesture);
    document.addEventListener('contextmenu', blockMenu);

    return () => {
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('contextmenu', blockMenu);
    };
  }, []);
};
