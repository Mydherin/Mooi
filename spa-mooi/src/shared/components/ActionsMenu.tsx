import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
import { cn } from '@/shared/utils/cn';

interface ActionsMenuProps {
  label: string;
  /** Receives `dismiss` so an item can close the menu before acting. */
  children: (dismiss: () => void) => ReactNode;
  className?: string;
}

/**
 * Secondary actions behind one icon: arrow keys move between items, Escape and outside clicks
 * close it, and the panel scrolls within the viewport when it cannot fit.
 */
export const ActionsMenu = ({ label, children, className }: ActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);

  useOnClickOutside(containerRef, dismiss, open);
  useOnEscape(() => {
    dismiss();
    containerRef.current?.querySelector('button')?.focus();
  }, open);
  useEffect(() => {
    if (open) containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-10 items-center justify-center rounded-[10px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          open ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
          className,
        )}
      >
        <MoreHorizontal className="size-4.5" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next = event.key === 'ArrowDown' ? (index + 1) % items.length
              : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : null;
            if (next !== null) {
              event.preventDefault();
              items[next]?.focus();
            }
            if (event.key === 'Tab') dismiss();
          }}
          className="absolute top-full right-0 z-50 mt-2 max-h-[min(20rem,calc(100dvh-5rem))] w-[min(15rem,calc(100vw-2rem))] origin-top-right overflow-y-auto overscroll-contain animate-menu-in rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]"
        >
          {children(dismiss)}
        </div>
      ) : null}
    </div>
  );
};
