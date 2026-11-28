import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';

interface PlatformDeleteDialogProps {
  title: string;
  description: string;
  /** What stays and what goes, one line each. */
  consequences: string[];
  action: string;
  remove: () => Promise<unknown>;
  onClose: () => void;
  onDeleted: () => void;
}

/** Confirms removing a stored platform configuration and its variables. */
export const PlatformDeleteDialog = ({ title, description, consequences, action, remove, onClose, onDeleted }: PlatformDeleteDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true); setError(null);
    try { await remove(); onDeleted(); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  };

  return <ConfirmDialog open tone="danger" onClose={onClose} onConfirm={() => void confirm()} title={title} description={description}
    confirmLabel={action} busy={busy} error={error}>
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-callout text-ink-muted">
      {consequences.map((line) => <li key={line}>{line}</li>)}
    </ul>
  </ConfirmDialog>;
};
