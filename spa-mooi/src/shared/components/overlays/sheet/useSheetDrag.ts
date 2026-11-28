import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { SheetDetent } from '@/shared/components/overlays/sheet/SheetDetent';
import { rubberBand } from '@/shared/gestures/rubberBand';
import { useDrag } from '@/shared/gestures/useDrag';
import { createVelocityTracker } from '@/shared/gestures/velocityTracker';

interface UseSheetDragOptions {
  panel: RefObject<HTMLElement | null>;
  /** The sheet's body scroller: pulling down from its top drags the sheet instead. */
  scroller: RefObject<HTMLElement | null>;
  enabled: boolean;
  onDismiss: () => void;
  detents?: SheetDetent[];
}

/** How far a release is projected by its velocity, in ms: a flick travels further than a slow drag. */
const PROJECTION_MS = 180;

const settle = 'translate var(--duration-slow) var(--ease-sheet)';

/**
 * Drag-to-dismiss and detents for a bottom sheet. The grabber and header (`handleProps`) drag it
 * with pointer events; the body hands over to the sheet when pulled down from its top (or up while
 * a larger detent is left), with touch events, because the browser would otherwise claim that
 * gesture for scrolling. The sheet resists past its top (rubber band), snaps to the detent nearest
 * to where the release velocity projects it, and dismisses below the lowest one.
 */
export const useSheetDrag = ({ panel, scroller, enabled, onDismiss, detents }: UseSheetDragOptions) => {
  const rest = useRef(0);
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  const offsets = (): number[] => {
    const height = panel.current?.offsetHeight ?? 0;
    const viewport = window.visualViewport?.height ?? window.innerHeight;
    if (!detents?.length) return [0];
    return [...new Set(detents.map((detent) => (detent === 'large' ? 0 : Math.max(0, height - viewport * 0.5))))].sort((a, b) => a - b);
  };

  const place = (offset: number, animate: boolean) => {
    const element = panel.current;
    if (!element) return;
    element.style.transition = animate ? settle : 'none';
    element.style.translate = offset === 0 ? '' : `0 ${offset}px`;
  };

  const move = (dy: number) => {
    const height = panel.current?.offsetHeight ?? 1;
    const next = rest.current + dy;
    place(next < 0 ? rubberBand(next, height) : next, false);
  };

  const release = (dy: number, vy: number) => {
    const height = panel.current?.offsetHeight ?? 1;
    const stops = offsets();
    const lowest = stops.at(-1) ?? 0;
    const projected = rest.current + dy + vy * PROJECTION_MS;
    if (projected > lowest + Math.min(height * 0.3, 160) || (vy > 0.9 && dy > 0 && rest.current === lowest)) {
      latest.current();
      return;
    }
    const nearest = stops.reduce((best, stop) => (Math.abs(stop - projected) < Math.abs(best - projected) ? stop : best), stops[0] ?? 0);
    rest.current = nearest;
    place(nearest, true);
  };

  // The first detent is where the sheet opens; placed once per opening (`move`/`release` read refs only).
  useLayoutEffect(() => {
    if (!enabled || !detents?.length) return;
    const first = detents[0] === 'large' ? 0 : offsets().at(-1) ?? 0;
    rest.current = first;
    place(first, false);
  }, [enabled]);

  useEffect(() => {
    const element = scroller.current;
    if (!enabled || !element) return;
    const tracker = createVelocityTracker();
    let start: { x: number; y: number } | null = null;
    let active = false;
    let dy = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) return;
      start = { x: touch.clientX, y: touch.clientY };
      active = false;
      tracker.reset();
      tracker.add(touch.clientX, touch.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      tracker.add(touch.clientX, touch.clientY);
      dy = touch.clientY - start.y;
      if (!active) {
        const dx = touch.clientX - start.x;
        if (Math.abs(dy) < 6 || Math.abs(dx) > Math.abs(dy)) return;
        const atTop = element.scrollTop <= 0;
        const expandable = rest.current > 0;
        if (!((dy > 0 && atTop) || (dy < 0 && expandable))) {
          start = null;
          return;
        }
        active = true;
        start = { x: touch.clientX, y: touch.clientY };
        dy = 0;
      }
      if (event.cancelable) event.preventDefault();
      move(dy);
    };

    const onTouchEnd = () => {
      if (active) release(dy, tracker.velocity().vy);
      start = null;
      active = false;
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, scroller]);

  const handleProps = useDrag({
    axis: 'y',
    enabled,
    // Only the grabber and header drag (they are `touch-none`); the body hands over through touch events above.
    filter: (event) => event.target instanceof Element && event.target.closest('[data-sheet-handle]') !== null
      && event.target.closest('button, a, input, textarea, select, [role="tab"]') === null,
    onMove: ({ dy }) => move(dy),
    onEnd: ({ dy, vy }) => release(dy, vy),
    onCancel: () => place(rest.current, true),
  });

  return { handleProps };
};
