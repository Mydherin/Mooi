import { useId, useRef, type ReactNode, type RefObject } from 'react';
import type { DialogSize } from '@/shared/components/overlays/dialog/DialogSize';
import { dialogWidths } from '@/shared/components/overlays/dialog/dialogWidths';
import { ModalSurface } from '@/shared/components/overlays/surface/ModalSurface';
import { SurfaceBody } from '@/shared/components/overlays/surface/SurfaceBody';
import { SurfaceFooter } from '@/shared/components/overlays/surface/SurfaceFooter';
import { SurfaceHeader } from '@/shared/components/overlays/surface/SurfaceHeader';
import { useIsPhone } from '@/shared/hooks/useIsPhone';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky actions, `Cancel, …, Primary` (see `SurfaceFooter`). */
  footer?: ReactNode;
  size?: DialogSize;
  /** False while work is in flight: Escape, Back, the scrim, dragging and the close button do nothing. */
  dismissible?: boolean;
  /** Controls in the header, before the close button. */
  headerActions?: ReactNode;
  /** No body padding, for full-bleed lists. */
  flush?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
}

/**
 * A task or decision that needs the user's attention before going on: a centered card from `sm`,
 * a bottom sheet on phones (grabber, drag to dismiss, above the keyboard). Header and footer stay
 * put; the body is the only scroller.
 */
export const Dialog = ({ open, onClose, title, description, children, footer, size = 'md', dismissible = true,
  headerActions, flush, initialFocus, role }: DialogProps) => {
  const phone = useIsPhone();
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <ModalSurface open={open} onClose={onClose} dismissible={dismissible} presentation={phone ? 'sheet' : 'center'}
      labelledBy={titleId} describedBy={description ? descriptionId : undefined} role={role}
      widthClassName={dialogWidths[size]} initialFocus={initialFocus} scroller={scroller}>
      <SurfaceHeader titleId={titleId} title={title} descriptionId={descriptionId} description={description}
        actions={headerActions} onClose={onClose} closeDisabled={!dismissible} handle={phone} />
      <SurfaceBody scroller={scroller} flush={flush} last={!footer}>{children}</SurfaceBody>
      {footer ? <SurfaceFooter>{footer}</SurfaceFooter> : null}
    </ModalSurface>
  );
};
