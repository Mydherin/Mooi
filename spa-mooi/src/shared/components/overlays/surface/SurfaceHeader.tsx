import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/shared/components/actions/IconButton';
import { cn } from '@/shared/utils/cn';

interface SurfaceHeaderProps {
  titleId: string;
  title: string;
  descriptionId?: string;
  description?: ReactNode;
  /** Extra controls before the close button. */
  actions?: ReactNode;
  onClose: () => void;
  closeDisabled: boolean;
  /** Bottom sheets: the header is also the drag handle. */
  handle: boolean;
  /** Visually hides the title (it still names the dialog). */
  hideTitle?: boolean;
}

/** Title, description and close button: sticky above the body, which is the only scroller. */
export const SurfaceHeader = ({ titleId, title, descriptionId, description, actions, onClose, closeDisabled, handle, hideTitle = false }: SurfaceHeaderProps) => (
  <header data-sheet-handle={handle || undefined}
    className={cn('flex shrink-0 items-start gap-3 border-b border-line pr-2 pl-5 sm:pl-6', handle ? 'touch-none pt-5 pb-3' : 'py-3.5',
      hideTitle && !description && 'border-b-0 pb-0')}>
    <div className={cn('min-w-0 flex-1 pt-1.5', hideTitle && 'sr-only')}>
      <h2 id={titleId} className="text-headline text-ink sm:text-[1.125rem]">{title}</h2>
      {description ? <div id={descriptionId} className="mt-1 text-footnote break-words text-ink-muted sm:text-callout">{description}</div> : null}
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1">
      {actions}
      <IconButton icon={X} label="Close" onClick={onClose} disabled={closeDisabled} />
    </div>
  </header>
);
