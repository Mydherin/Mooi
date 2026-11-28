import { useEffect, useState, type RefObject } from 'react';

/**
 * True once `target` (a large title) has scrolled under the sticky bar of `offset` px, observed
 * against the page's own scroller: no scroll listener, no work while nothing moves.
 */
export const useCollapsedOnScroll = (target: RefObject<HTMLElement | null>, scroller: RefObject<HTMLElement | null> | null, offset: number): boolean => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(entry ? !entry.isIntersecting : false),
      { root: scroller?.current ?? null, rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, scroller, offset]);

  return collapsed;
};
