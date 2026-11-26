import { useState } from 'react';
import { GitCommitHorizontal, LoaderCircle } from 'lucide-react';
import { COMMIT_TYPES, isConventionalCommit } from '@/features/sessions/lib/conventionalCommit';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface MergeDialogProps {
  targetBranch: string;
  branch: string;
  changes: ChangesSummary | null | undefined;
  merging: boolean;
  error: string | null;
  onCancel: () => void;
  onCommit: (message: string) => void;
}

const MAX_TITLE = 200;

/** Asks for the one mandatory input of a merge: the title of the single commit pushed to the target. */
export const MergeDialog = ({ targetBranch, branch, changes, merging, error, onCancel, onCommit }: MergeDialogProps) => {
  const [title, setTitle] = useState('');
  const conventional = isConventionalCommit(title.trim());
  const valid = title.trim().length > 0 && conventional;
  const submit = () => {
    if (valid && !merging) onCommit(title.trim());
  };

  return (
    <Modal open onClose={merging ? () => undefined : onCancel} title={`Merge into ${targetBranch}`}
      description={`No conflicts found. The changes of ${branch} land on ${targetBranch} as one commit, then it is pushed.`}
      footer={<>
        <Button variant="ghost" onClick={onCancel} disabled={merging}>Cancel</Button>
        <Button variant="brand" onClick={submit} disabled={!valid || merging}>
          {merging ? <LoaderCircle className="size-4 animate-spin" /> : <GitCommitHorizontal className="size-4" />}
          {merging ? 'Merging…' : 'Commit & push'}
        </Button>
      </>}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-muted">Commit title <span className="text-danger">*</span></span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={MAX_TITLE} autoCapitalize="none"
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
            disabled={merging} required autoFocus placeholder="e.g. feat: add project search"
            enterKeyHint="send" autoComplete="off" aria-invalid={title.trim().length > 0 && !conventional}
            aria-describedby="merge-title-hint"
            className="h-12 rounded-control border border-line bg-surface-2 px-3 text-base text-ink outline-none transition focus:border-brand disabled:opacity-60 sm:text-sm" />
          <span id="merge-title-hint"
            className={`text-xs [overflow-wrap:anywhere] ${title.trim().length > 0 && !conventional ? 'text-danger' : 'text-ink-muted'}`}>
            Conventional Commits: <span className="font-mono">type(scope): description</span>, with type {COMMIT_TYPES.join(', ')}.
          </span>
        </label>
        {changes ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>{changes.files.length} {changes.files.length === 1 ? 'file' : 'files'} changed</span>
            <span className="font-mono text-success">+{changes.added}</span>
            <span className="font-mono text-danger">−{changes.removed}</span>
          </p>
        ) : null}
        {error ? <p role="alert" className="text-sm text-danger [overflow-wrap:anywhere]">{error}</p> : null}
      </div>
    </Modal>
  );
};
