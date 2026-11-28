import { FileWarning } from 'lucide-react';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';

interface MergeConflictsDialogProps {
  open: boolean;
  targetBranch: string;
  conflicts: string[];
  resolving: boolean;
  error: string | null;
  onClose: () => void;
  onResolve: () => void;
}

/** Shows which files collide with the target before handing the merge to the agent in a fresh conversation. */
export const MergeConflictsDialog = ({ open, targetBranch, conflicts, resolving, error, onClose, onResolve }: MergeConflictsDialogProps) => (
  <ConfirmDialog open={open} onClose={onClose} onConfirm={onResolve} busy={resolving} error={error}
    title="Resolve conflicts" confirmLabel="Resolve with the agent"
    description={`${targetBranch} changed the same ${conflicts.length === 1 ? 'file' : 'files'}. The chat restarts with a fresh conversation that merges both sides, keeping the features of each, then merges.`}>
    {conflicts.length > 0 ? (
      <ul aria-label="Conflicting files" className="flex max-h-56 flex-col divide-y divide-line overflow-y-auto overscroll-contain rounded-control border border-line bg-surface-2">
        {conflicts.map((path) => (
          <li key={path} className="flex min-w-0 items-start gap-2 px-3 py-2">
            <FileWarning aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span className="min-w-0 font-mono text-mono text-ink [overflow-wrap:anywhere]">{path}</span>
          </li>
        ))}
      </ul>
    ) : null}
  </ConfirmDialog>
);
