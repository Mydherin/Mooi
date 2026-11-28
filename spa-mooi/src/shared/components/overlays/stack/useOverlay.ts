import { useEffect, useId, useRef, type RefObject } from 'react';
import type { OverlayEntry } from '@/shared/components/overlays/stack/OverlayEntry';
import { registerOverlay, unregisterOverlay } from '@/shared/components/overlays/stack/overlayStack';

interface UseOverlayOptions {
  open: boolean;
  onDismiss: () => void;
  modal: boolean;
  layer: RefObject<HTMLElement | null>;
  anchor?: RefObject<HTMLElement | null>;
  /** False while the overlay must stay open (work in flight). Defaults to true. */
  dismissible?: boolean;
}

/**
 * Puts an overlay on the stack while `open` (see `overlayStack`): Escape, Back, outside presses and
 * inert background. The latest callbacks are read through a ref, so callers never memoize them.
 */
export const useOverlay = ({ open, onDismiss, modal, layer, anchor, dismissible = true }: UseOverlayOptions): void => {
  const id = useId();
  const latest = useRef({ onDismiss, dismissible });
  latest.current = { onDismiss, dismissible };

  useEffect(() => {
    if (!open) return;
    const entry: OverlayEntry = {
      id,
      modal,
      layer: () => layer.current,
      anchor: () => anchor?.current ?? null,
      dismissible: () => latest.current.dismissible,
      dismiss: () => latest.current.onDismiss(),
      historyPushed: false,
      returnFocus: null,
    };
    registerOverlay(entry);
    return () => unregisterOverlay(entry);
  }, [open, id, modal, layer, anchor]);
};
