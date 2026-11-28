import { useCallback, type RefObject } from 'react';
import { rubberBand } from '@/shared/gestures/rubberBand';
import { scrollableAncestor } from '@/shared/gestures/scrollableAncestor';
import { useDrag } from '@/shared/gestures/useDrag';

interface UseSwipeTabsOptions {
  /** The panel that follows the finger. */
  target: RefObject<HTMLElement | null>;
  index: number;
  count: number;
  onChange: (index: number) => void;
  enabled?: boolean;
}

/** iOS reserves the screen edges for its own back/forward swipe: presses that start there are left alone. */
const EDGE = 24;

/**
 * Horizontal swipe between sibling panels (the visible equivalent is the tab strip). It never
 * fights vertical scroll: the panel keeps `touch-action: pan-y`, a gesture that locks vertically
 * is the browser's, and presses that start in a horizontal scroller, in `[data-swipe-ignore]` or at
 * a screen edge are skipped. Past a quarter of the width, or with a flick, it moves one panel.
 */
export const useSwipeTabs = ({ target, index, count, onChange, enabled = true }: UseSwipeTabsOptions) => {
  const reset = useCallback((animate: boolean) => {
    const element = target.current;
    if (!element) return;
    element.style.transition = animate ? 'translate var(--duration-base) var(--ease-out-expo)' : 'none';
    element.style.translate = '';
  }, [target]);

  return useDrag({
    axis: 'x',
    threshold: 10,
    enabled: enabled && count > 1,
    filter: (event) => {
      if (event.pointerType === 'mouse') return false;
      if (event.clientX < EDGE || event.clientX > window.innerWidth - EDGE) return false;
      if (event.target instanceof Element && event.target.closest('[data-swipe-ignore], input, textarea, [contenteditable="true"]')) return false;
      return scrollableAncestor(event.target, 'x', target.current) === null;
    },
    onStart: () => reset(false),
    onMove: ({ dx }) => {
      const element = target.current;
      if (!element) return;
      const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
      const offset = atEdge ? rubberBand(dx, element.offsetWidth, 0.3) : dx;
      element.style.translate = `${offset}px 0`;
    },
    onEnd: ({ dx, vx }) => {
      const width = target.current?.offsetWidth ?? window.innerWidth;
      const next = dx < -width * 0.25 || vx < -0.45 ? index + 1 : dx > width * 0.25 || vx > 0.45 ? index - 1 : index;
      if (next !== index && next >= 0 && next < count) {
        reset(false);
        onChange(next);
      } else {
        reset(true);
      }
    },
    onCancel: () => reset(true),
  });
};
