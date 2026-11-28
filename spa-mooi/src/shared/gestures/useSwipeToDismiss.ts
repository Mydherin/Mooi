import type { RefObject } from 'react';
import { rubberBand } from '@/shared/gestures/rubberBand';
import { useDrag } from '@/shared/gestures/useDrag';

export type SwipeDirection = 'down' | 'left' | 'right' | 'up';

interface UseSwipeToDismissOptions {
  /** The element that follows the finger. */
  target: RefObject<HTMLElement | null>;
  direction: SwipeDirection;
  onDismiss: () => void;
  enabled?: boolean;
  /** Share of the element's size past which a release dismisses. */
  distance?: number;
  /** Release speed (px/ms) that dismisses whatever the distance: a flick. */
  velocity?: number;
}

const sign = (direction: SwipeDirection): number => (direction === 'down' || direction === 'right' ? 1 : -1);
const vertical = (direction: SwipeDirection): boolean => direction === 'down' || direction === 'up';

/**
 * Drag an element away to dismiss it (toasts, banners, side panels). It follows the finger in the
 * dismiss direction, resists the other way (rubber band), and on release either leaves with the
 * finger's momentum or springs back. Pair it with a visible close button: it is never the only way.
 */
export const useSwipeToDismiss = ({ target, direction, onDismiss, enabled = true, distance = 0.35, velocity = 0.5 }: UseSwipeToDismissOptions) => {
  const axis = vertical(direction) ? 'y' : 'x';
  // The `translate` property composes with transform keyframes, so an exit animation starts where the finger left off.
  const translate = (offset: number) => (axis === 'y' ? `0 ${offset}px` : `${offset}px 0`);

  return useDrag({
    axis,
    enabled,
    onStart: () => {
      if (target.current) target.current.style.transition = 'none';
    },
    onMove: ({ dx, dy }) => {
      const element = target.current;
      if (!element) return;
      const raw = (axis === 'y' ? dy : dx) * sign(direction);
      const size = axis === 'y' ? element.offsetHeight : element.offsetWidth;
      const offset = raw >= 0 ? raw : rubberBand(raw, size);
      element.style.translate = translate(offset * sign(direction));
    },
    onEnd: ({ dx, dy, vx, vy }) => {
      const element = target.current;
      if (!element) return;
      const travelled = (axis === 'y' ? dy : dx) * sign(direction);
      const speed = (axis === 'y' ? vy : vx) * sign(direction);
      const size = axis === 'y' ? element.offsetHeight : element.offsetWidth;
      const dismiss = travelled > size * distance || speed > velocity;
      element.style.transition = 'translate var(--duration-base) var(--ease-out-expo), opacity var(--duration-base) var(--ease-out-expo)';
      if (dismiss) {
        element.style.translate = translate(size * 1.1 * sign(direction));
        element.style.opacity = '0';
        window.setTimeout(onDismiss, 160);
      } else {
        element.style.translate = '';
      }
    },
    onCancel: () => {
      const element = target.current;
      if (!element) return;
      element.style.transition = 'translate var(--duration-base) var(--ease-out-expo)';
      element.style.translate = '';
    },
  });
};
