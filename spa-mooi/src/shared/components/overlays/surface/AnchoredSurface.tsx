import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useAnchoredPosition } from '@/shared/components/overlays/positioning/useAnchoredPosition';
import type { Placement } from '@/shared/components/overlays/positioning/Placement';
import { OverlayPortal } from '@/shared/components/overlays/stack/OverlayPortal';
import { useFocusTrap } from '@/shared/components/overlays/stack/useFocusTrap';
import { useOverlay } from '@/shared/components/overlays/stack/useOverlay';
import { usePresence } from '@/shared/components/overlays/stack/usePresence';
import { cn } from '@/shared/utils/cn';

interface AnchoredSurfaceProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  placement: Placement;
  /** At least as wide as the anchor (selects). */
  matchWidth?: boolean;
  id?: string;
  role: 'menu' | 'dialog' | 'listbox';
  label: string;
  initialFocus?: RefObject<HTMLElement | null>;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * A non-modal floating panel next to its anchor (menus, popovers, listboxes on desktop): flips
 * above when there is no room below, shifts to stay on screen and scrolls inside the room left.
 * It closes on Escape, Back or a press outside it, and the page stays usable around it.
 */
export const AnchoredSurface = ({ open, onClose, anchor, placement, matchWidth, id, role, label, initialFocus,
  onKeyDown, className, style, children }: AnchoredSurfaceProps) => {
  const layer = useRef<HTMLDivElement>(null);
  const floating = useRef<HTMLDivElement>(null);
  const { mounted, state } = usePresence(open, 100);

  useOverlay({ open, onDismiss: onClose, modal: false, layer, anchor });
  useFocusTrap(floating, { active: open, initialFocus });
  useAnchoredPosition(mounted, anchor, floating, { placement, matchWidth });

  if (!mounted) return null;

  return (
    <OverlayPortal>
      <div ref={layer} className="pointer-events-none fixed inset-0">
        <div
          ref={floating}
          id={id}
          role={role}
          aria-label={label}
          tabIndex={-1}
          data-overlay="anchored"
          data-state={state}
          onKeyDown={onKeyDown}
          style={style}
          className={cn('pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-pop outline-none',
            state === 'closed' && 'pointer-events-none', className)}
        >
          {children}
        </div>
      </div>
    </OverlayPortal>
  );
};
