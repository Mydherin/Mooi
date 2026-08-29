import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/shared/components/IconButton';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
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

const widths = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) => {
  useOnEscape(onClose, open);
  useLockBodyScroll(open);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/70 p-4 backdrop-blur-sm sm:items-center">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 cursor-default" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[85dvh] w-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-2xl',
          widths[size],
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
            ) : null}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} className="-mt-1 -mr-2" />
        </div>

        {/* The body scrolls, never the dialog: a long list must not push the title off a phone. */}
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="mt-6 flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
      </div>
    </div>
  );
};
