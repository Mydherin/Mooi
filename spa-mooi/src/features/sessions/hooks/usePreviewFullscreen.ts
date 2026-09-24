import { useEffect, useRef, useState } from 'react';

export const usePreviewFullscreen = (enabled: boolean) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const generation = useRef(0);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const changed = () => {
      const active = document.fullscreenElement === panel;
      setNative(active);
      if (!active) restoreFocus.current?.focus();
    };
    document.addEventListener('fullscreenchange', changed);
    return () => {
      generation.current += 1;
      document.removeEventListener('fullscreenchange', changed);
      if (panel && document.fullscreenElement === panel) void document.exitFullscreen().catch(() => {});
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setExpanded(false);
      setNative(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button, a[href], iframe, summary, [tabindex="0"]') ?? []);
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) focusable()[0]?.focus();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
      } else if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', containFocus);
      restoreFocus.current?.focus();
    };
  }, [expanded]);

  const toggle = async () => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    if (document.fullscreenElement === panel) {
      try { await document.exitFullscreen(); } catch { /* Keep the exit control available. */ }
      return;
    }
    if (expanded) { setExpanded(false); return; }
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = generation.current;
    if (document.fullscreenEnabled && panel.requestFullscreen) {
      try {
        await panel.requestFullscreen();
        if (current !== generation.current && document.fullscreenElement === panel) await document.exitFullscreen();
        return;
      } catch { /* Use the expanded panel when fullscreen is unavailable or denied. */ }
    }
    if (current === generation.current) setExpanded(true);
  };

  return { panelRef, expanded, fullscreen: native || expanded, toggle };
};
