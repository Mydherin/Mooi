import { useId, useRef, type ReactNode } from 'react';
import { MenuItemRow } from '@/shared/components/overlays/menu/MenuItemRow';
import { moveMenuFocus } from '@/shared/components/overlays/menu/moveMenuFocus';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import type { MenuSection } from '@/shared/components/overlays/menu/MenuSection';
import { ModalSurface } from '@/shared/components/overlays/surface/ModalSurface';

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  header?: ReactNode;
  sections: MenuSection[];
  onSelect: (item: MenuItem) => void;
}

/**
 * A menu on phones and touch screens: grouped inset lists in a bottom sheet, tall rows in thumb
 * reach, destructive items in red and a separate Cancel at the bottom, like a native action sheet.
 */
export const ActionSheet = ({ open, onClose, label, header, sections, onSelect }: ActionSheetProps) => {
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();

  return (
    <ModalSurface open={open} onClose={onClose} dismissible presentation="sheet" labelledBy={titleId} scroller={scroller}>
      <div data-sheet-handle className="shrink-0 touch-none px-5 pt-6 pb-2 text-center">
        <h2 id={titleId} className="truncate text-footnote font-semibold text-ink-subtle">{label}</h2>
      </div>
      <div ref={scroller} data-scroller role="menu" aria-labelledby={titleId} onKeyDown={moveMenuFocus}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-canvas/60 px-3 pt-1 pb-3">
        {header ? <div className="overflow-hidden rounded-card border border-line bg-surface">{header}</div> : null}
        {sections.map((section) => (
          <div key={section.id} role="group" aria-label={section.title}>
            {section.title ? <p className="px-4 pb-1.5 text-caption font-semibold tracking-[0.04em] text-ink-subtle uppercase">{section.title}</p> : null}
            {section.note ? <div className="mb-2 px-4 text-footnote text-ink-muted">{section.note}</div> : null}
            {section.items.length > 0 ? (
              <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {section.items.map((item) => <MenuItemRow key={item.id} item={item} variant="sheet" onSelect={onSelect} />)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-line px-3 pt-2 pb-[calc(0.5rem+var(--safe-bottom))]">
        <button type="button" onClick={onClose}
          className="flex h-13 w-full items-center justify-center rounded-card bg-surface-2 text-body font-semibold text-ink transition active:scale-[0.98] active:bg-surface-3">
          Cancel
        </button>
      </div>
    </ModalSurface>
  );
};
