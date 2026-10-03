import { useEffect, useState } from 'react';

/** Reveals `text` one character at a time. Remount (key) the caller to restart it. */
export const useTypewriter = (text: string, intervalMs = 24): string => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current >= text.length) window.clearInterval(timer);
        return Math.min(current + 1, text.length);
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [text, intervalMs]);

  return text.slice(0, count);
};
