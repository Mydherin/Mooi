import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { DragAxis, DragState } from '@/shared/gestures/DragState';
import { createVelocityTracker } from '@/shared/gestures/velocityTracker';

export interface UseDragOptions {
  /** Only this axis starts a drag; a gesture that locks to the other one is left to the browser (scrolling). */
  axis?: DragAxis;
  /** Distance before the axis locks and the drag starts, in px. */
  threshold?: number;
  enabled?: boolean;
  /** Return false to leave this press alone (edge swipes, nested scrollers...). */
  filter?: (event: PointerEvent) => boolean;
  /** Return false to decline the drag once its axis is known. */
  onStart?: (state: DragState) => boolean | void;
  onMove?: (state: DragState) => void;
  onEnd?: (state: DragState) => void;
  /** The browser took the gesture over (it started scrolling) or the pointer was lost. */
  onCancel?: () => void;
}

/**
 * Pointer drag with axis lock and release velocity, for touch, pen and mouse.
 *
 * The axis locks once the pointer travels `threshold` px; a gesture that locks to the other axis
 * is abandoned, so the browser keeps scrolling. Callers set `touch-action` on the element to the
 * axis the browser owns (`pan-y` for a horizontal swipe, `none` for a sheet grabber): that is what
 * keeps a horizontal swipe from ever fighting vertical scroll. A click that ends a drag is
 * swallowed, so dragging a row never also opens it.
 */
export const useDrag = (options: UseDragOptions): { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void } => {
  const latest = useRef(options);
  latest.current = options;
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const { enabled = true, filter } = latest.current;
    if (!enabled || (event.pointerType === 'mouse' && event.button !== 0) || !event.isPrimary) return;
    if (filter && !filter(event.nativeEvent)) return;
    cleanup.current?.();

    const element = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const tracker = createVelocityTracker();
    tracker.add(startX, startY);
    let axis: DragAxis | null = null;
    let dragging = false;

    const state = (moveEvent: PointerEvent): DragState => {
      const { vx, vy } = tracker.velocity();
      return { dx: moveEvent.clientX - startX, dy: moveEvent.clientY - startY, vx, vy, axis: axis ?? 'y',
        pointerType: event.pointerType, target: event.target };
    };

    const swallowClick = (clickEvent: MouseEvent) => {
      clickEvent.stopPropagation();
      clickEvent.preventDefault();
    };

    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      cleanup.current = null;
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      tracker.add(moveEvent.clientX, moveEvent.clientY, moveEvent.timeStamp || performance.now());
      if (!axis) {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (Math.max(dx, dy) < (latest.current.threshold ?? 6)) return;
        axis = dx > dy ? 'x' : 'y';
        if (latest.current.axis && latest.current.axis !== axis) {
          stop();
          return;
        }
        if (latest.current.onStart?.(state(moveEvent)) === false) {
          stop();
          return;
        }
        dragging = true;
        element.setPointerCapture(pointerId);
      }
      if (dragging) {
        if (moveEvent.cancelable) moveEvent.preventDefault();
        latest.current.onMove?.(state(moveEvent));
      }
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      stop();
      if (!dragging) return;
      window.addEventListener('click', swallowClick, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallowClick, true), 0);
      latest.current.onEnd?.(state(upEvent));
    };

    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      stop();
      if (dragging) latest.current.onCancel?.();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    cleanup.current = stop;
  }, []);

  return { onPointerDown };
};
