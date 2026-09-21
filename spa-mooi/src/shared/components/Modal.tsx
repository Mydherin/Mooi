import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '@/shared/components/IconButton';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';
import { cn } from '@/shared/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

export const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useLockBodyScroll(open);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => {
      element.close();
      trigger?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-3 text-ink open:flex open:items-center open:justify-center backdrop:bg-black/55 backdrop:backdrop-blur-sm sm:p-6"
    >
      <div className={cn('flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]', size === 'lg' ? 'max-w-2xl' : 'max-w-lg')}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[22px] font-extrabold tracking-[-0.03em]">{title}</h2>
            {description ? <p id={descriptionId} className="mt-2 break-words text-sm leading-relaxed text-ink-muted">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} className="-mr-2 -mt-2" />
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">{children}</div>
        {footer ? <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</footer> : null}
      </div>
    </dialog>, document.body,
  );
};
