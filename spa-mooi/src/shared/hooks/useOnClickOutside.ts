import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Closes a floating surface when the pointer goes down anywhere else.
 *
 * `pointerdown` rather than `click`: a menu that survives until the button is released feels stuck,
 * and a click that starts outside is already a decision to leave.
 */
export const useOnClickOutside = (
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled = true,
): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && !ref.current?.contains(target)) {
        handler();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);

    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [enabled, handler, ref]);
};
