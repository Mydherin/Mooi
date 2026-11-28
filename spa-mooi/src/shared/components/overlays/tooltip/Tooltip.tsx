import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useAnchoredPosition } from '@/shared/components/overlays/positioning/useAnchoredPosition';
import type { PlacementAlign, PlacementSide } from '@/shared/components/overlays/positioning/Placement';
import { OverlayPortal } from '@/shared/components/overlays/stack/OverlayPortal';
import { useLongPress } from '@/shared/gestures/useLongPress';
import { cn } from '@/shared/utils/cn';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Lets the trigger take focus, for content that is not otherwise focusable (a truncated path). */
  focusable?: boolean;
  placement?: PlacementSide;
  align?: PlacementAlign;
  /** Monospace for paths and code; plain text for sentences. */
  mono?: boolean;
  /** Hover delay on desktop, in ms. */
  delay?: number;
}

const TOUCH_MS = 2500;

/**
 * A read-only hint: shown on hover (after a short delay) and keyboard focus on desktop, and on a
 * long press on touch screens, where it leaves on its own. It is portaled with fixed coordinates
 * (no scroller clips it) and never interactive. Never make it the only way to reach information:
 * what matters on phones must also be visible or one tap away (see `TruncatedText`, `Popover`).
 */
export const Tooltip = ({ content, children, className, focusable = false, placement = 'bottom', align = 'start', mono = true, delay = 350 }: TooltipProps) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const id = useId();

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);
  const showAfter = (ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), ms);
  };
  const longPress = useLongPress(() => {
    setOpen(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), TOUCH_MS);
  });

  useAnchoredPosition(open, anchor, bubble, { placement: `${placement}-${align}`, gap: 6 });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={open ? id : undefined}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') showAfter(delay); }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') hide(); longPress.onPointerLeave(); }}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onClickCapture={longPress.onClickCapture}
      onFocus={(event) => { if (event.target.matches(':focus-visible')) setOpen(true); }}
      onBlur={hide}
      className={cn('relative inline-flex max-w-full min-w-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', className)}
    >
      {children}
      {open ? (
        <OverlayPortal>
          <div ref={bubble} id={id} role="tooltip"
            className={cn('pointer-events-none fixed z-(--z-tooltip) w-max animate-fade-in rounded-chip border border-line-strong bg-surface px-2.5 py-1.5 text-[11.5px] leading-snug text-ink shadow-pop',
              mono ? 'font-mono break-all' : 'font-sans font-medium break-words whitespace-pre-line')}
            style={{ maxWidth: 'min(32rem, calc(100vw - 1rem))' }}>
            {content}
          </div>
        </OverlayPortal>
      ) : null}
    </span>
  );
};
