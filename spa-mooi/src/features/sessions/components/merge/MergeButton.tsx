import { useEffect, useState } from 'react';
import { Check, GitMerge, TriangleAlert } from 'lucide-react';
import { HeaderActionHint } from '@/features/sessions/components/HeaderActionHint';
import type { useMerge } from '@/features/sessions/hooks/useMerge';
import { HEADER_ACTION_CLASS } from '@/features/sessions/lib/headerActionClass';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/actions/Button';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { cn } from '@/shared/utils/cn';
import { shortCommit } from '@/shared/utils/shortCommit';
import { useSessionsStore } from '@/stores/sessionsStore';
import { MergeConflictsDialog } from './MergeConflictsDialog';
import { MergeDialog } from './MergeDialog';

interface MergeButtonProps {
  session: Session;
  merge: ReturnType<typeof useMerge>;
  disabled?: boolean;
}

/**
 * Merge the session into its project's default branch. Offered once the workspace has changes;
 * a conflicting check turns the same control into "Resolve conflicts", which lists the files and
 * hands the merge to the session's agent in a fresh conversation. Once merged, and until the
 * workspace changes again, the control stays as a quiet "Merged" state instead of disappearing.
 */
export const MergeButton = ({ session, merge, disabled = false }: MergeButtonProps) => {
  const changes = useSessionsStore((state) => state.byId[session.id]?.changes);
  const lastMerge = useSessionsStore((state) => state.byId[session.id]?.lastMerge ?? null);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const { phase, result, error, check, commit, resolve, cancel } = merge;
  const hasChanges = Boolean(changes?.files.length);
  const merged = phase === 'merged' || phase === 'up_to_date' || (phase === 'idle' && !hasChanges && Boolean(lastMerge));
  const target = result?.targetBranch ?? lastMerge?.targetBranch ?? session.baseBranch;
  const conflicted = phase === 'conflicts' || phase === 'resolving';
  const conflicts = result?.conflicts ?? [];

  useEffect(() => {
    if (!conflicted) setConflictsOpen(false);
  }, [conflicted]);

  if (!hasChanges && !merged && phase === 'idle' && !error) return null;

  if (merged && !error) {
    const mergedCommit = result?.commit ?? lastMerge?.commit ?? null;
    const hint = phase === 'up_to_date' ? `${target} already has these changes`
      : `Merged into ${target}${mergedCommit ? ` · ${shortCommit(mergedCommit)}` : ''}`;
    return (
      <HeaderActionHint hint={hint}>
        <span role="status" aria-label={hint}
          className={buttonStyles('secondary', 'sm', cn(HEADER_ACTION_CLASS, 'cursor-default animate-fade-in hover-device:hover:bg-surface'))}>
          <Check aria-hidden className="size-4 text-success" />
          <span className="hidden sm:inline">{phase === 'up_to_date' ? 'Up to date' : 'Merged'}</span>
        </span>
      </HeaderActionHint>
    );
  }

  const loading = phase === 'checking' || phase === 'merging';
  const blocked = disabled || loading || phase === 'resolving' || session.status !== 'ready' || Boolean(session.pending)
    || session.deployment.state === 'starting' || !session.workspacePath;
  const label = phase === 'checking' ? 'Checking…' : phase === 'merging' ? 'Merging…' : conflicted ? 'Resolve conflicts' : 'Merge';
  const dialogOpen = phase === 'ready' || phase === 'merging';
  const hint = dialogOpen || conflictsOpen ? null : error ?? (conflicted
    ? `Conflicts with ${target} in ${conflicts.length} ${conflicts.length === 1 ? 'file' : 'files'}` : null);

  return (
    <>
      <HeaderActionHint hint={hint}>
        <Button variant={conflicted ? 'danger' : 'secondary'} size="sm" disabled={blocked} loading={loading}
          icon={conflicted ? TriangleAlert : GitMerge} className={HEADER_ACTION_CLASS}
          ariaLabel={conflicted ? `Resolve conflicts with ${target}` : `Merge into ${target}`}
          onClick={() => (conflicted ? setConflictsOpen(true) : void check())}>
          <span className="hidden sm:inline">{label}</span>
          {error ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot" /> : null}
        </Button>
      </HeaderActionHint>
      <MergeDialog open={dialogOpen} targetBranch={target} branch={session.branch} changes={changes}
        merging={phase === 'merging'} error={error} onCancel={cancel} onCommit={(title) => void commit(title)} />
      <MergeConflictsDialog open={conflictsOpen && conflicted} targetBranch={target} conflicts={conflicts}
        resolving={phase === 'resolving'} error={error} onClose={() => setConflictsOpen(false)}
        onResolve={() => void resolve()} />
    </>
  );
};
