import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { ActionSheet } from '@/shared/components/overlays/menu/ActionSheet';
import { MenuItemRow } from '@/shared/components/overlays/menu/MenuItemRow';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import type { MenuSection } from '@/shared/components/overlays/menu/MenuSection';
import type { MenuTriggerProps } from '@/shared/components/overlays/menu/MenuTriggerProps';
import { moveMenuFocus } from '@/shared/components/overlays/menu/moveMenuFocus';
import { visibleSections } from '@/shared/components/overlays/menu/visibleSections';
import type { Placement } from '@/shared/components/overlays/positioning/Placement';
import { AnchoredSurface } from '@/shared/components/overlays/surface/AnchoredSurface';
import { useSheetPickers } from '@/shared/hooks/useSheetPickers';
import { cn } from '@/shared/utils/cn';
import { formatCount } from '@/shared/utils/formatCount';

interface MenuProps {
  /** Names the menu and its trigger; the title of the action sheet on phones. */
  label: string;
  sections: MenuSection[];
  /** Content above the items (an account card). */
  header?: ReactNode;
  /** A custom trigger; spread the props onto a button. Defaults to an icon button. */
  renderTrigger?: (props: MenuTriggerProps) => ReactNode;
  icon?: LucideIcon;
  /** A count beside the default trigger's icon. */
  count?: number;
  /** An attention dot on the default trigger. */
  indicator?: boolean;
  triggerClassName?: string;
  placement?: Placement;
  width?: 'sm' | 'md' | 'lg';
  /** Controlled open state (e.g. opened by a long press elsewhere). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const widths = { sm: 'w-56', md: 'w-64', lg: 'w-80' };

/**
 * Actions or a context menu: an anchored popover on fine pointers (arrow keys, Home/End, flips
 * and scrolls to stay on screen) and an action sheet on phones and touch screens. Selecting an
 * item closes the menu first, then acts, so a dialog opened by the item stacks cleanly.
 */
export const Menu = ({ label, sections, header, renderTrigger, icon: Icon = MoreHorizontal, count, indicator = false,
  triggerClassName, placement = 'bottom-end', width = 'sm', open: controlledOpen, onOpenChange }: MenuProps) => {
  const sheet = useSheetPickers();
  const trigger = useRef<HTMLButtonElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const id = useId();
  const groups = visibleSections(sections);

  const setOpen = useCallback((next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  const select = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.keepOpen) {
      item.onSelect?.();
      return;
    }
    setOpen(false);
    item.onSelect?.();
  };

  // The first item takes focus, so arrow keys work at once; the popover surface itself took it a moment earlier.
  useEffect(() => {
    if (open && !sheet) document.getElementById(id)?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [open, sheet, id]);

  const triggerProps: MenuTriggerProps = {
    ref: trigger,
    onClick: () => setOpen(!open),
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    'data-state': open ? 'open' : 'closed',
  };

  return (
    <>
      {renderTrigger ? renderTrigger(triggerProps) : (
        <button {...triggerProps} type="button" aria-label={label} title={label}
          className={cn(
            "relative flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-control transition-[background-color,color,transform] duration-150 before:absolute before:-inset-0.5 before:content-[''] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            open ? 'bg-surface-2 text-ink' : 'text-ink-muted hover-device:hover:bg-surface-2 hover-device:hover:text-ink',
            count !== undefined && 'px-2',
            triggerClassName,
          )}>
          <Icon aria-hidden className="size-4.5" />
          {count !== undefined ? <span aria-hidden className="min-w-4.5 rounded-full bg-brand-soft px-1.5 text-caption leading-4.5 font-bold text-brand tabular-nums">{formatCount(count)}</span> : null}
          {indicator ? <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-danger-dot ring-2 ring-surface" /> : null}
        </button>
      )}

      {sheet ? (
        <ActionSheet open={open} onClose={() => setOpen(false)} label={label} header={header} sections={groups} onSelect={select} />
      ) : (
        <AnchoredSurface open={open} onClose={() => setOpen(false)} anchor={trigger} placement={placement} id={id} role="menu" label={label}
          className={cn(widths[width], 'max-w-[calc(100vw-1rem)]')}
          onKeyDown={(event) => {
            if (moveMenuFocus(event)) return;
            if (event.key === 'Tab') setOpen(false);
          }}>
          <div data-scroller className="min-h-0 overflow-y-auto overscroll-contain p-1">
            {header ? <div className="mb-1 border-b border-line pb-1">{header}</div> : null}
            {groups.map((section, index) => (
              <div key={section.id} role="group" aria-label={section.title} className={cn(index > 0 && 'mt-1 border-t border-line pt-1')}>
                {section.title ? <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-bold tracking-[0.06em] text-ink-subtle uppercase">{section.title}</p> : null}
                {section.note ? <div className="mx-1 mb-1 text-footnote text-ink-muted">{section.note}</div> : null}
                {section.items.map((item) => <MenuItemRow key={item.id} item={item} variant="popover" onSelect={select} />)}
              </div>
            ))}
          </div>
        </AnchoredSurface>
      )}
    </>
  );
};
