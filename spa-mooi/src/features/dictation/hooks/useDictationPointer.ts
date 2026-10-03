import { useEffect, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { DictationController } from '@/features/dictation/types/DictationController';

/** Holding at least this long turns the press into push-to-talk; shorter is a tap (toggle). */
const HOLD_MS = 350;

interface PointerHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Mouse and touch on the microphone button. `pointerdown` is prevented so the button never steals
 * focus from the field being dictated into. Release is tracked on `window` (capture phase): the
 * finger may leave the button while holding it, and the release is the user activation mobile
 * browsers require before audio may run. A press while still connecting cancels, so the button is
 * never stuck waiting. A click with `detail === 0` is a keyboard activation (Enter/Space) and toggles.
 */
export const useDictationPointer = ({ state, isActive, start, stop, cancel, resumeAudio }: DictationController): PointerHandlers => {
  const press = useRef<{ id: number; at: number } | null>(null);

  useEffect(() => {
    const onRelease = (event: PointerEvent) => {
      const current = press.current;
      if (!current || current.id !== event.pointerId) return;
      press.current = null;
      resumeAudio();
      if (event.type === 'pointercancel' || performance.now() - current.at >= HOLD_MS) stop();
    };

    window.addEventListener('pointerup', onRelease, true);
    window.addEventListener('pointercancel', onRelease, true);

    return () => {
      window.removeEventListener('pointerup', onRelease, true);
      window.removeEventListener('pointercancel', onRelease, true);
    };
  }, [resumeAudio, stop]);

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (state === 'connecting') {
        cancel();
        return;
      }
      if (isActive()) {
        stop();
        return;
      }
      press.current = { id: event.pointerId, at: performance.now() };
      start();
    },
    onClick: (event) => {
      if (event.detail !== 0) return;
      if (state === 'connecting') cancel();
      else if (isActive()) stop();
      else start();
    },
    onContextMenu: (event) => event.preventDefault(),
  };
};
