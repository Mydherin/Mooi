import { useId, useRef, type ReactNode, type RefObject } from 'react';
import type { DialogSize } from '@/shared/components/overlays/dialog/DialogSize';
import { dialogWidths } from '@/shared/components/overlays/dialog/dialogWidths';
import type { SheetDetent } from '@/shared/components/overlays/sheet/SheetDetent';
import { ModalSurface } from '@/shared/components/overlays/surface/ModalSurface';
import { SurfaceBody } from '@/shared/components/overlays/surface/SurfaceBody';
import { SurfaceFooter } from '@/shared/components/overlays/surface/SurfaceFooter';
import { SurfaceHeader } from '@/shared/components/overlays/surface/SurfaceHeader';
import { useIsPhone } from '@/shared/hooks/useIsPhone';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Names the sheet; shown in its header unless `hideTitle`. */
  title: string;
  hideTitle?: boolean;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Resting heights on phones; the first is where it opens. Content height when omitted. */
  detents?: SheetDetent[];
  /** What it becomes from `sm`: a centered dialog (default), a side panel, or still a bottom sheet. */
  desktop?: 'dialog' | 'side' | 'sheet';
  size?: DialogSize;
  dismissible?: boolean;
  headerActions?: ReactNode;
  flush?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * Supplementary content or a set of choices that slides up from the bottom on phones (grabber,
 * drag to dismiss with velocity and rubber band, optional `medium`/`large` detents) and becomes a
 * dialog or a side panel on larger screens.
 */
export const Sheet = ({ open, onClose, title, hideTitle, description, children, footer, detents, desktop = 'dialog',
  size = 'md', dismissible = true, headerActions, flush, initialFocus }: SheetProps) => {
  const phone = useIsPhone();
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const presentation = phone || desktop === 'sheet' ? 'sheet' : desktop === 'side' ? 'side' : 'center';

  return (
    <ModalSurface open={open} onClose={onClose} dismissible={dismissible} presentation={presentation}
      labelledBy={titleId} describedBy={description ? descriptionId : undefined}
      widthClassName={dialogWidths[size]} detents={phone ? detents : undefined} initialFocus={initialFocus} scroller={scroller}>
      <SurfaceHeader titleId={titleId} title={title} hideTitle={hideTitle} descriptionId={descriptionId} description={description}
        actions={headerActions} onClose={onClose} closeDisabled={!dismissible} handle={presentation === 'sheet'} />
      <SurfaceBody scroller={scroller} flush={flush} last={!footer}>{children}</SurfaceBody>
      {footer ? <SurfaceFooter>{footer}</SurfaceFooter> : null}
    </ModalSurface>
  );
};
