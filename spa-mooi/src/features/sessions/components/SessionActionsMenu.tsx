import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, FolderGit2, MoreHorizontal, XCircle } from 'lucide-react';
import type { Session } from '@/features/sessions/types/Session';
import { MenuAction } from '@/shared/components/MenuAction';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
import { cn } from '@/shared/utils/cn';

interface SessionActionsMenuProps {
  session: Session;
  onClose: () => void;
  closeBusy: boolean;
}

/**
 * Secondary session actions behind one icon. Closing is destructive and rare, so it lives here
 * instead of competing with the branch name and the deploy control for header space.
 */
export const SessionActionsMenu = ({ session, onClose, closeBusy }: SessionActionsMenuProps) => {
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

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).catch(() => undefined);
    dismiss();
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Session actions"
        title="Session actions"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-10 items-center justify-center rounded-[10px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          open ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        )}
      >
        <MoreHorizontal className="size-4.5" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Session actions"
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
          className="absolute top-full right-0 z-50 mt-2 w-[min(15rem,calc(100vw-2rem))] origin-top-right animate-menu-in rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]"
        >
          <MenuAction icon={Copy} label="Copy branch name" onClick={() => copy(session.branch)} />
          <MenuAction
            icon={FolderGit2}
            label="Copy clone path"
            disabled={!session.workspacePath}
            onClick={() => session.workspacePath && copy(session.workspacePath)}
          />
          <div className="my-1 h-px bg-line" />
          <MenuAction
            icon={XCircle}
            label={closeBusy ? 'Closing…' : 'Close session'}
            tone="danger"
            disabled={closeBusy}
            onClick={() => {
              dismiss();
              onClose();
            }}
          />
        </div>
      ) : null}
    </div>
  );
};
