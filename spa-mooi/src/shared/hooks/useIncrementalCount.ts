import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Renders a long list in steps: `count` starts at `step` and grows by `step` whenever the returned
 * sentinel ref (placed after the rendered items) scrolls into view.
 * The DOM only ever holds what the reader has reached, so huge lists open instantly.
 */
export const useIncrementalCount = (total: number, step = 400) => {
  const [count, setCount] = useState(step);
  const observer = useRef<IntersectionObserver | null>(null);

  const sentinel = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    observer.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setCount((current) => current + step);
    });
    observer.current.observe(node);
  }, [step]);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { count: Math.min(count, total), more: count < total, sentinel };
};
