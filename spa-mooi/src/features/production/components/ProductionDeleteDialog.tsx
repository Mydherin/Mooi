import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { deleteProductionConfiguration } from '@/features/production/api/productionApi';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface ProductionDeleteDialogProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}

/** Removes the stored configuration and its variables; the running service and the history stay. */
export const ProductionDeleteDialog = ({ projectId, projectName, onClose, onDeleted }: ProductionDeleteDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true); setError(null);
    try { await deleteProductionConfiguration(projectId); onDeleted(); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  };

  return <Modal open onClose={busy ? () => undefined : onClose} title="Delete deployment configuration"
    description={`Removes DEPLOYMENT.md, deploy.sh, status.sh and every stored environment variable of ${projectName}.`}
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="danger" onClick={() => void remove()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{busy ? 'Deleting…' : 'Delete configuration'}
      </Button></>}>
    <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-muted">
      <li>The service already running in production is not stopped.</li>
      <li>The deployment history and its saved output stay available.</li>
      <li>The deployment chat is closed; setting up again starts from scratch.</li>
    </ul>
    {error ? <p role="alert" className="mt-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p> : null}
  </Modal>;
};
