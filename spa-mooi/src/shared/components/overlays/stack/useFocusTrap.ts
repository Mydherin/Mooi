import { useEffect, type RefObject } from 'react';
import { focusableWithin } from '@/shared/components/overlays/stack/focusable';

interface UseFocusTrapOptions {
  active: boolean;
  /** What takes focus on open; the container itself by default (no stray ring, no keyboard popping up). */
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * Moves focus into `container` on open and keeps Tab cycling inside it while active. The
 * background is also `inert`, and the stack gives focus back to the trigger on close
 * (see `overlayStack`), so this only closes the loop.
 */
export const useFocusTrap = (container: RefObject<HTMLElement | null>, { active, initialFocus }: UseFocusTrapOptions): void => {
  useEffect(() => {
    const element = container.current;
    if (!active || !element) return;
    (initialFocus?.current ?? element).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusableWithin(element);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === element)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [active, container, initialFocus]);
};
