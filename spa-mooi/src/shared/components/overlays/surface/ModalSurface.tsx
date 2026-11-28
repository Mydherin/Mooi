import { useRef, type ReactNode, type RefObject } from 'react';
import { OverlayPortal } from '@/shared/components/overlays/stack/OverlayPortal';
import { useFocusTrap } from '@/shared/components/overlays/stack/useFocusTrap';
import { useOverlay } from '@/shared/components/overlays/stack/useOverlay';
import { usePresence } from '@/shared/components/overlays/stack/usePresence';
import type { SheetDetent } from '@/shared/components/overlays/sheet/SheetDetent';
import { useSheetDrag } from '@/shared/components/overlays/sheet/useSheetDrag';
import type { ModalPresentation } from '@/shared/components/overlays/surface/ModalPresentation';
import { cn } from '@/shared/utils/cn';

interface ModalSurfaceProps {
  open: boolean;
  onClose: () => void;
  dismissible: boolean;
  presentation: ModalPresentation;
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  /** Width of the centered or side panel. */
  widthClassName?: string;
  detents?: SheetDetent[];
  initialFocus?: RefObject<HTMLElement | null>;
  /** The body scroller: pulling down from its top drags the sheet. */
  scroller: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const EXIT_MS: Record<ModalPresentation, number> = { sheet: 240, center: 150, side: 240 };

const layout: Record<ModalPresentation, string> = {
  sheet: 'flex-col justify-end',
  center: 'items-center justify-center p-6 pt-[max(1.5rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))]',
  side: 'justify-end',
};

const panel: Record<ModalPresentation, string> = {
  sheet: 'w-full max-h-[calc(100%-var(--safe-top)-0.75rem)] rounded-t-sheet border-t border-line shadow-sheet',
  center: 'w-full max-h-full rounded-panel border border-line shadow-pop',
  side: 'h-full w-[min(28rem,100%)] border-l border-line pt-(--safe-top) shadow-pop',
};

/**
 * The modal frame every dialog and sheet shares: a scrim, a panel in one of three presentations,
 * the overlay stack (Escape, Back, inert background), a focus trap, enter/exit motion and, for
 * sheets, drag-to-dismiss with optional detents. The layer follows the visible viewport, so a
 * sheet always sits above the on-screen keyboard.
 */
export const ModalSurface = ({ open, onClose, dismissible, presentation, labelledBy, describedBy, role = 'dialog',
  widthClassName, detents, initialFocus, scroller, children }: ModalSurfaceProps) => {
  const layer = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const { mounted, state } = usePresence(open, EXIT_MS[presentation]);
  const dismiss = () => { if (dismissible) onClose(); };

  useOverlay({ open, onDismiss: onClose, modal: true, layer, dismissible });
  useFocusTrap(surface, { active: open, initialFocus });
  const { handleProps } = useSheetDrag({ panel: surface, scroller, enabled: open && presentation === 'sheet' && dismissible, onDismiss: onClose, detents });

  if (!mounted) return null;

  return (
    <OverlayPortal>
      <div ref={layer} className={cn('fixed inset-x-0 top-(--app-offset) flex h-app', layout[presentation])}>
        <div aria-hidden data-overlay="scrim" data-state={state} onClick={dismiss}
          className="absolute inset-0 touch-none bg-scrim" />
        <div
          ref={surface}
          role={role}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          tabIndex={-1}
          data-overlay={presentation}
          data-state={state}
          onPointerDown={presentation === 'sheet' ? handleProps.onPointerDown : undefined}
          className={cn('relative flex min-h-0 flex-col overflow-hidden bg-surface text-ink outline-none will-change-transform',
            panel[presentation], presentation === 'sheet' && Boolean(detents?.length) && 'h-[calc(100%-var(--safe-top)-0.75rem)]',
            presentation !== 'sheet' && widthClassName)}
        >
          {presentation === 'sheet' ? (
            <span aria-hidden data-sheet-handle className="absolute inset-x-0 top-0 z-sticky flex h-5 touch-none justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-line-strong" />
            </span>
          ) : null}
          {children}
        </div>
      </div>
    </OverlayPortal>
  );
};
