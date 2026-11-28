import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import type { MenuTriggerProps } from '@/shared/components/overlays/menu/MenuTriggerProps';
import type { Placement } from '@/shared/components/overlays/positioning/Placement';
import { Sheet } from '@/shared/components/overlays/sheet/Sheet';
import { AnchoredSurface } from '@/shared/components/overlays/surface/AnchoredSurface';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import { cn } from '@/shared/utils/cn';

interface PopoverProps {
  /** Names the popover and its trigger; the sheet's title on phones. */
  label: string;
  /** The content; receives `close` for content that finishes the task (a filter applied, a value copied). */
  content: ReactNode | ((close: () => void) => ReactNode);
  /** The default trigger's content: a full-width text button. Use `renderTrigger` for anything else. */
  children?: ReactNode;
  renderTrigger?: (props: MenuTriggerProps) => ReactNode;
  triggerClassName?: string;
  placement?: Placement;
  /** Panel classes on desktop (width, padding). */
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Interactive content anchored to its trigger (details, filters, small forms): a non-modal
 * floating panel on desktop, a bottom sheet on phones. Use `Menu` for a list of actions and
 * `Tooltip` for a read-only hint.
 */
export const Popover = ({ label, content, children, renderTrigger, triggerClassName, placement = 'bottom-start', className,
  open: controlledOpen, onOpenChange }: PopoverProps) => {
  const phone = useIsPhone();
  const trigger = useRef<HTMLButtonElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const id = useId();

  const setOpen = useCallback((next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const body = typeof content === 'function' ? content(close) : content;

  const triggerProps: MenuTriggerProps = {
    ref: trigger,
    onClick: () => setOpen(!open),
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    'data-state': open ? 'open' : 'closed',
  };

  return (
    <>
      {renderTrigger ? renderTrigger(triggerProps) : (
        <button {...triggerProps} type="button" aria-label={label}
          className={cn('block w-full min-w-0 rounded-chip text-left transition active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', triggerClassName)}>
          {children}
        </button>
      )}
      {phone ? (
        <Sheet open={open} onClose={close} title={label}>{body}</Sheet>
      ) : (
        <AnchoredSurface open={open} onClose={close} anchor={trigger} placement={placement} id={id} role="dialog" label={label}
          className={cn('w-max max-w-[min(26rem,calc(100vw-1rem))]', className)}>
          <div data-scroller className="min-h-0 overflow-y-auto overscroll-contain p-3">{body}</div>
        </AnchoredSurface>
      )}
    </>
  );
};
