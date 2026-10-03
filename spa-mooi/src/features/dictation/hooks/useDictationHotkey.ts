import { useEffect, useRef, type RefObject } from 'react';
import type { DictationController } from '@/features/dictation/types/DictationController';
import type { DictationField } from '@/features/dictation/types/DictationField';

const isCombo = (event: KeyboardEvent): boolean =>
  event.code === 'Period' && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;

const RELEASE_KEYS = new Set(['Period', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);

/**
 * Keyboard push-to-talk for the bound field: while it has focus, hold Ctrl+Shift+. to record and
 * release any of the three keys to finish; Escape discards a running dictation. Physical key
 * (`code`), so it works on every layout; not Ctrl+Shift+Space, which macOS uses to switch input
 * sources. Capture phase on `window`, so Escape never reaches a surrounding dialog.
 */
export const useDictationHotkey = (field: RefObject<DictationField | null>, { isActive, start, stop, cancel }: DictationController): void => {
  const holding = useRef(false);

  useEffect(() => {
    const release = () => {
      if (!holding.current) return;
      holding.current = false;
      stop();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isActive()) {
        event.preventDefault();
        event.stopPropagation();
        holding.current = false;
        cancel();
        return;
      }
      if (!isCombo(event) || document.activeElement !== field.current) return;
      event.preventDefault();
      if (event.repeat || isActive()) return;
      holding.current = true;
      start();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (RELEASE_KEYS.has(event.code) || event.key === 'Control' || event.key === 'Shift') release();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', release);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', release);
    };
  }, [cancel, field, isActive, start, stop]);
};
