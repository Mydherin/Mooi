import type { ReactNode } from 'react';
import { Button } from '@/shared/components/actions/Button';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { Alert } from '@/shared/components/feedback/Alert';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  /** Extra content between the description and the actions (what will be lost, a checkbox). */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive confirmations. */
  tone?: 'default' | 'danger';
  /** The confirmation is running: buttons wait and the dialog cannot be dismissed. */
  busy?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
}

/** "Are you sure?" for consequential actions: one sentence of consequence, Cancel and the action. */
export const ConfirmDialog = ({ open, onClose, onConfirm, title, description, children, confirmLabel, cancelLabel = 'Cancel',
  tone = 'default', busy = false, confirmDisabled = false, error }: ConfirmDialogProps) => (
  <Dialog open={open} onClose={onClose} title={title} size="sm" dismissible={!busy} role="alertdialog"
    footer={<>
      <Button variant="ghost" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
      <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} disabled={confirmDisabled}>{confirmLabel}</Button>
    </>}>
    <div className="flex flex-col gap-4">
      {description ? <div className="text-callout text-ink-muted">{description}</div> : null}
      {children}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  </Dialog>
);
