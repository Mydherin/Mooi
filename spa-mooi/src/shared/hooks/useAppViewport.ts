import { useEffect } from 'react';
import { isTextEntry } from '@/shared/utils/isTextEntry';

/**
 * Keeps the app shell glued to the visible viewport, the way a native app sits above its keyboard.
 *
 * iOS never resizes the layout viewport for the on-screen keyboard: it scrolls the whole page up
 * instead, pushing the header out and hiding what is being typed. The visual viewport is the only
 * reliable measure, so its height becomes `--app-height` (the shell's height), its offset
 * `--app-offset` (where the shell starts when iOS pans it anyway) and any page scroll the browser
 * introduces is undone. `data-keyboard` marks a touch device with a text field focused,
 * for the `keyboard:` variant.
 */
export const useAppViewport = (): void => {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const touch = window.matchMedia('(pointer: coarse)');
    let frame = 0;
    let lastHeight = 0;

    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const height = Math.round(viewport?.height ?? window.innerHeight);
        const active = document.activeElement;
        const keyboard = touch.matches && isTextEntry(active);
        root.style.setProperty('--app-height', `${height}px`);
        root.style.setProperty('--app-offset', `${Math.max(0, Math.round(viewport?.offsetTop ?? 0))}px`);
        root.toggleAttribute('data-keyboard', keyboard);
        if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        // The shell shrank under the field being typed in: bring it back into its own scroller.
        if (keyboard && height !== lastHeight) active?.scrollIntoView({ block: 'nearest' });
        lastHeight = height;
      });
    };

    sync();
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, { passive: true });
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
    };
  }, []);
};
