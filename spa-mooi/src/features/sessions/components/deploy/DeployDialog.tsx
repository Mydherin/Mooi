import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { deployTargets } from '@/features/sessions/data/deployTargets';
import { DeployTargetRow } from '@/features/sessions/components/deploy/DeployTargetRow';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface DeployDialogProps {
  open: boolean;
  onClose: () => void;
  branch: string;
}

export const DeployDialog = ({ open, onClose, branch }: DeployDialogProps) => {
  const [targetId, setTargetId] = useState(deployTargets[0].id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deploy session"
      description={`Deploys run from the session branch ${branch}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onClose}>
            <Rocket className="size-4" />
            Deploy
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Deploy target" className="flex flex-col gap-2">
        {deployTargets.map((target) => (
          <DeployTargetRow
            key={target.id}
            target={target}
            selected={target.id === targetId}
            onSelect={setTargetId}
          />
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-subtle">
        6 files changed · <span className="text-success">+176</span>{' '}
        <span className="text-danger">−94</span>
      </p>
    </Modal>
  );
};
