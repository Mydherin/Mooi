import { useState, type FormEvent } from 'react';
import { Link2Off, Trash2 } from 'lucide-react';
import type { Project } from '@/features/projects/types/Project';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

export type ProjectRemovalAction = 'unlink' | 'delete-repository';

interface RemoveProjectDialogProps {
  project: Project;
  busyAction: ProjectRemovalAction | null;
  error: string | null;
  onClose: () => void;
  onUnlink: () => void;
  onDeleteRepository: () => void;
}

/**
 * Keeps Mooi removal and GitHub deletion visibly separate. Unlinking is the first, conservative
 * action; deleting upstream remains available but requires the repository's full name.
 */
export const RemoveProjectDialog = ({
  project,
  busyAction,
  error,
  onClose,
  onUnlink,
  onDeleteRepository,
}: RemoveProjectDialogProps) => {
  const [confirmation, setConfirmation] = useState('');
  const busy = busyAction !== null;
  const submitDeletion = (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === project.fullName && !busy) onDeleteRepository();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Remove project"
      description={`Choose what should happen to ${project.fullName}.`}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>}
    >
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-line bg-surface-2/50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Link2Off className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-ink">Unlink from Mooi</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Removes this project and its Mooi-managed configuration. The GitHub repository,
                including its code, issues and settings, stays untouched.
              </p>
              <Button
                variant="secondary"
                onClick={onUnlink}
                disabled={busy}
                className="mt-4 w-full sm:w-auto"
              >
                {busyAction === 'unlink' ? 'Unlinking…' : 'Unlink from Mooi'}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-danger/35 bg-danger-soft/40 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <Trash2 className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-danger">Delete GitHub repository</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Permanently deletes the repository on GitHub and removes the project from Mooi.
                This cannot be undone here.
              </p>

              <form onSubmit={submitDeletion} className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-2 text-sm font-bold text-ink">
                  Type <span className="font-mono break-all">{project.fullName}</span> to confirm
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={busy}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-sm text-ink outline-none focus:border-danger disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <Button
                  variant="danger"
                  type="submit"
                  disabled={busy || confirmation !== project.fullName}
                  className="w-full sm:w-fit"
                >
                  {busyAction === 'delete-repository' ? 'Deleting…' : 'Delete repository'}
                </Button>
              </form>
            </div>
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};
