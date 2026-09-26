import { useState, type FormEvent } from 'react';
import type { Project } from '@/features/projects/types/Project';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface DeleteProjectDialogProps {
  project: Project;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onDelete: () => void;
}

export const DeleteProjectDialog = ({ project, busy, error, onClose, onDelete }: DeleteProjectDialogProps) => {
  const [confirmation, setConfirmation] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === project.fullName && !busy) onDelete();
  };

  return (
    <Modal open onClose={onClose} title="Delete GitHub repository"
      description={`This permanently deletes ${project.fullName} from GitHub and removes it from Mooi.`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="danger" type="submit" form="delete-project-form"
          disabled={busy || confirmation !== project.fullName}>
          {busy ? 'Deleting…' : 'Delete repository'}
        </Button></>}>
      <form id="delete-project-form" onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-danger">Repository code, issues and settings will be deleted on GitHub. This cannot be undone here.</p>
        <label className="flex flex-col gap-2 text-sm font-bold text-ink">
          Type <span className="font-mono">{project.fullName}</span> to confirm
          <input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off" spellCheck={false}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-sm text-ink outline-none focus:border-danger" />
        </label>
        {error ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  );
};
