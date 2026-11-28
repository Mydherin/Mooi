const scrolls = (element: Element, axis: 'x' | 'y'): boolean => {
  const style = getComputedStyle(element);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  return axis === 'x' ? element.scrollWidth > element.clientWidth + 1 : element.scrollHeight > element.clientHeight + 1;
};

/** The closest ancestor of `target` (up to `boundary`) that scrolls along `axis`, if any. */
export const scrollableAncestor = (target: EventTarget | null, axis: 'x' | 'y', boundary?: Element | null): Element | null => {
  let element = target instanceof Element ? target : null;
  while (element && element !== boundary?.parentElement) {
    if (scrolls(element, axis)) return element;
    if (element === boundary) break;
    element = element.parentElement;
  }
  return null;
};
