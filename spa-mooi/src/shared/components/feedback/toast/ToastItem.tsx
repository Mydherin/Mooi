import { useEffect, useRef } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import type { ToastMessage } from '@/shared/components/feedback/toast/ToastMessage';
import { useSwipeToDismiss } from '@/shared/gestures/useSwipeToDismiss';
import { cn } from '@/shared/utils/cn';

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const icons = { neutral: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };
const inks = { neutral: 'text-ink-subtle', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };

/** One toast: leaves after its duration (paused while pressed or hovered), on swipe down or on its close button. */
export const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const element = useRef<HTMLLIElement>(null);
  const timer = useRef(0);
  const tone = toast.tone ?? 'neutral';
  const Icon = icons[tone];
  const dismiss = () => onDismiss(toast.id);
  const swipe = useSwipeToDismiss({ target: element, direction: 'down', onDismiss: dismiss });

  const schedule = () => {
    window.clearTimeout(timer.current);
    if (toast.duration) timer.current = window.setTimeout(dismiss, toast.duration);
  };

  useEffect(() => {
    schedule();
    return () => window.clearTimeout(timer.current);
    // Rescheduled only when the toast itself changes.
  }, [toast]);

  return (
    <li ref={element} data-overlay="toast" data-state="open"
      onPointerDown={(event) => { window.clearTimeout(timer.current); swipe.onPointerDown(event); }}
      onPointerUp={schedule} onPointerEnter={() => window.clearTimeout(timer.current)} onPointerLeave={schedule}
      className="pointer-events-auto flex w-full touch-none items-start gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur-xl sm:w-96">
      <Icon aria-hidden className={cn('mt-0.5 size-4.5 shrink-0', inks[tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-callout font-semibold break-words text-ink">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-footnote break-words text-ink-muted">{toast.description}</p> : null}
      </div>
      {toast.action ? (
        <button type="button" onClick={() => { toast.action?.onAction(); dismiss(); }}
          className="-my-1 h-9 shrink-0 rounded-chip px-2.5 text-callout font-semibold text-brand transition active:scale-95 hover-device:hover:bg-brand-soft">
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss" onClick={dismiss}
        className="-my-1.5 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-chip text-ink-subtle transition active:scale-95 hover-device:hover:bg-surface-2">
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
};
