import { useLayoutEffect, useState, type RefObject } from 'react';

interface AnchoredPlacement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 4;
const MARGIN = 12;

/**
 * Fixed coordinates for a dropdown panel portaled out of its trigger: below it, or above when the
 * viewport has more room there, at the trigger's width and never taller than the space left.
 */
export const useAnchoredPlacement = (open: boolean, anchor: RefObject<HTMLElement | null>, preferredHeight = 256): AnchoredPlacement => {
  const [placement, setPlacement] = useState<AnchoredPlacement>({ top: 0, left: 0, width: 0, maxHeight: preferredHeight });

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const bounds = anchor.current?.getBoundingClientRect();
      if (!bounds) return;
      const below = window.innerHeight - bounds.bottom - MARGIN;
      const above = bounds.top - MARGIN;
      const upward = below < 180 && above > below;
      const maxHeight = Math.max(64, Math.min(preferredHeight, upward ? above : below));
      setPlacement({ top: upward ? bounds.top - maxHeight - GAP : bounds.bottom + GAP, left: bounds.left, width: bounds.width, maxHeight });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, anchor, preferredHeight]);

  return placement;
};
