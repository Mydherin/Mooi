import { useRef, useState, type FormEvent } from 'react';
import { GitCommitHorizontal } from 'lucide-react';
import { COMMIT_TYPES, isConventionalCommit } from '@/features/sessions/lib/conventionalCommit';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { TextField } from '@/shared/components/forms/TextField';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';

interface MergeDialogProps {
  open: boolean;
  targetBranch: string;
  branch: string;
  changes: ChangesSummary | null | undefined;
  merging: boolean;
  error: string | null;
  onCancel: () => void;
  onCommit: (message: string) => void;
}

const MAX_TITLE = 200;
const FORM_ID = 'merge-commit-form';

/** Asks for the one mandatory input of a merge: the title of the single commit pushed to the target. */
export const MergeDialog = ({ open, targetBranch, branch, changes, merging, error, onCancel, onCommit }: MergeDialogProps) => {
  const [title, setTitle] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const trimmed = title.trim();
  const conventional = isConventionalCommit(trimmed);
  const valid = trimmed.length > 0 && conventional;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && !merging) onCommit(trimmed);
  };

  return (
    <Dialog open={open} onClose={onCancel} dismissible={!merging} title={`Merge into ${targetBranch}`} initialFocus={field}
      description={<>No conflicts found. The changes of <span className="font-mono [overflow-wrap:anywhere]">{branch}</span> land on {targetBranch} as one commit, then it is pushed.</>}
      footer={<>
        <Button variant="ghost" onClick={onCancel} disabled={merging}>Cancel</Button>
        <Button variant="brand" type="submit" form={FORM_ID} icon={GitCommitHorizontal} loading={merging} disabled={!valid}>
          {merging ? 'Merging…' : 'Commit & push'}
        </Button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4">
        <TextField ref={field} label="Commit title" required value={title} onChange={setTitle} maxLength={MAX_TITLE} disabled={merging}
          placeholder="feat: add project search" autoCapitalize="none" autoComplete="off" spellCheck={false} enterKeyHint="send" mono
          error={trimmed.length > 0 && !conventional ? `Use Conventional Commits: type(scope): description, with type ${COMMIT_TYPES.join(', ')}.` : null}
          hint={<>Conventional Commits: <span className="font-mono">type(scope): description</span>.</>} />
        {changes ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-ink-muted">
            <span>{changes.files.length} {changes.files.length === 1 ? 'file' : 'files'} changed</span>
            <span className="font-mono text-success tabular-nums">+{changes.added}</span>
            <span className="font-mono text-danger tabular-nums">−{changes.removed}</span>
          </p>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Dialog>
  );
};
