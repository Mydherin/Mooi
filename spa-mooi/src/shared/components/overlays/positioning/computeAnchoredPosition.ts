import type { Placement, PlacementAlign, PlacementSide } from '@/shared/components/overlays/positioning/Placement';

export interface AnchoredPosition {
  top: number;
  left: number;
  /** The room left on the chosen side: the floating element scrolls inside it. */
  maxHeight: number;
  maxWidth: number;
  side: PlacementSide;
}

interface Bounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Options {
  placement: Placement;
  /** Space between the anchor and the floating element. */
  gap?: number;
  /** Space kept free at the viewport edges (the safe areas come on top). */
  margin?: number;
  /** Below this height the other side is tried when it has more room. */
  minHeight?: number;
}

/** The visible viewport in layout coordinates: the keyboard and iOS panning shrink and move it. */
export const visibleViewport = (): Bounds => {
  const viewport = window.visualViewport;
  return viewport
    ? { top: viewport.offsetTop, left: viewport.offsetLeft, width: viewport.width, height: viewport.height }
    : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
};

const alignedLeft = (anchor: DOMRect, width: number, align: PlacementAlign): number =>
  align === 'start' ? anchor.left : align === 'end' ? anchor.right - width : anchor.left + (anchor.width - width) / 2;

/**
 * Where a floating element goes next to its anchor: on the preferred side when it fits (or has the
 * most room), aligned as asked, then shifted horizontally so it never leaves the visible viewport,
 * and capped to the height left so it scrolls instead of overflowing.
 */
export const computeAnchoredPosition = (anchor: DOMRect, floating: { width: number; height: number },
  { placement, gap = 6, margin = 8, minHeight = 160 }: Options): AnchoredPosition => {
  const [preferred, align] = placement.split('-') as [PlacementSide, PlacementAlign];
  const view = visibleViewport();
  const top = view.top + margin;
  const bottom = view.top + view.height - margin;
  const roomBelow = bottom - anchor.bottom - gap;
  const roomAbove = anchor.top - gap - top;
  const fits = (side: PlacementSide) => (side === 'bottom' ? roomBelow : roomAbove) >= Math.min(floating.height, minHeight);
  const other: PlacementSide = preferred === 'bottom' ? 'top' : 'bottom';
  const side = fits(preferred) || (!fits(other) && (preferred === 'bottom' ? roomBelow >= roomAbove : roomAbove >= roomBelow))
    ? preferred : other;
  const maxHeight = Math.max(48, side === 'bottom' ? roomBelow : roomAbove);
  const height = Math.min(floating.height, maxHeight);
  const maxWidth = view.width - margin * 2;
  const width = Math.min(floating.width, maxWidth);
  const left = Math.min(Math.max(view.left + margin, alignedLeft(anchor, width, align)), view.left + view.width - margin - width);

  return {
    top: side === 'bottom' ? anchor.bottom + gap : anchor.top - gap - height,
    left,
    maxHeight,
    maxWidth,
    side,
  };
};
