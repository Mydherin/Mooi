import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

interface UseLongPressOptions {
  /** Hold time before it fires, in ms. */
  delay?: number;
  /** Movement that cancels the press (it became a scroll), in px. */
  tolerance?: number;
  enabled?: boolean;
}

interface LongPressHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Long press for touch, with its equivalents: right click on a mouse and the context-menu key or
 * Shift+F10 on a keyboard all fire the same callback. The click that ends a long press is
 * swallowed, so holding a row to open its actions never also opens the row.
 */
export const useLongPress = (onLongPress: () => void, { delay = 480, tolerance = 10, enabled = true }: UseLongPressOptions = {}): LongPressHandlers => {
  const timer = useRef(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const latest = useRef(onLongPress);
  latest.current = onLongPress;

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const fire = useCallback(() => {
    fired.current = true;
    navigator.vibrate?.(8);
    latest.current();
  }, []);

  return {
    onPointerDown: (event) => {
      fired.current = false;
      if (!enabled || event.pointerType === 'mouse') return;
      origin.current = { x: event.clientX, y: event.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { origin.current = null; fire(); }, delay);
    },
    onPointerMove: (event) => {
      if (!origin.current) return;
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > tolerance) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (event) => {
      if (!enabled) return;
      event.preventDefault();
      // Touch browsers also send `contextmenu` on a long press: the timer already handled it.
      if (fired.current || origin.current) return;
      fire();
    },
    onKeyDown: (event) => {
      if (enabled && event.shiftKey && event.key === 'F10') {
        event.preventDefault();
        fire();
      }
    },
    onClickCapture: (event) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
};
