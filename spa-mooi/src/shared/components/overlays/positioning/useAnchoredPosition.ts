import { useLayoutEffect, type RefObject } from 'react';
import { computeAnchoredPosition } from '@/shared/components/overlays/positioning/computeAnchoredPosition';
import type { Placement } from '@/shared/components/overlays/positioning/Placement';

interface Options {
  placement: Placement;
  gap?: number;
  /** Matches the floating element's minimum width to the anchor's (selects, comboboxes). */
  matchWidth?: boolean;
}

/**
 * Keeps a fixed-position floating element next to its anchor while `active`. Styles are written
 * straight to the element on scroll, resize and size changes (one frame at most), so following the
 * anchor never re-renders React.
 */
export const useAnchoredPosition = (active: boolean, anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>, { placement, gap, matchWidth = false }: Options): void => {
  useLayoutEffect(() => {
    const target = anchor.current;
    const element = floating.current;
    if (!active || !target || !element) return;
    let frame = 0;

    const place = () => {
      const bounds = target.getBoundingClientRect();
      if (matchWidth) element.style.minWidth = `${Math.round(bounds.width)}px`;
      const position = computeAnchoredPosition(bounds, { width: element.offsetWidth, height: element.scrollHeight }, { placement, gap });
      element.style.top = `${Math.round(position.top)}px`;
      element.style.left = `${Math.round(position.left)}px`;
      element.style.maxHeight = `${Math.floor(position.maxHeight)}px`;
      element.style.maxWidth = `${Math.floor(position.maxWidth)}px`;
      element.style.setProperty('--menu-shift', position.side === 'bottom' ? '-6px' : '6px');
      element.style.transformOrigin = `${placement.endsWith('end') ? 'right' : placement.endsWith('start') ? 'left' : 'center'} ${position.side === 'bottom' ? 'top' : 'bottom'}`;
      element.dataset.side = position.side;
    };
    const schedule = (event?: Event) => {
      // Scrolling inside the floating element itself never moves it.
      if (event?.target instanceof Node && element.contains(event.target)) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(place);
    };

    place();
    const observer = new ResizeObserver(() => schedule());
    observer.observe(element);
    observer.observe(target);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [active, anchor, floating, placement, gap, matchWidth]);
};
