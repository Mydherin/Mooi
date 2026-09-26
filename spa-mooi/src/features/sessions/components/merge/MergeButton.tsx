import { Check, GitMerge, LoaderCircle, TriangleAlert } from 'lucide-react';
import { HeaderActionHint } from '@/features/sessions/components/HeaderActionHint';
import { useMerge } from '@/features/sessions/hooks/useMerge';
import { HEADER_ACTION_CLASS } from '@/features/sessions/lib/headerActionClass';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { cn } from '@/shared/utils/cn';
import { shortCommit } from '@/shared/utils/shortCommit';
import { useSessionsStore } from '@/stores/sessionsStore';
import { MergeDialog } from './MergeDialog';

const LISTED_CONFLICTS = 8;

/**
 * Merge the session into its project's default branch. Offered once the workspace has changes;
 * a conflicting check turns the same control into "Resolve conflicts", which hands the merge to
 * the session's agent in a fresh conversation. Once merged, and until the workspace changes again,
 * the control stays as a quiet "Merged" state instead of disappearing.
 */
export const MergeButton = ({ session, disabled = false }: { session: Session; disabled?: boolean }) => {
  const changes = useSessionsStore((state) => state.byId[session.id]?.changes);
  const lastMerge = useSessionsStore((state) => state.byId[session.id]?.lastMerge ?? null);
  const { phase, result, error, check, commit, resolve, cancel } = useMerge(session.id);
  const hasChanges = Boolean(changes?.files.length);
  const merged = phase === 'merged' || phase === 'up_to_date' || (phase === 'idle' && !hasChanges && Boolean(lastMerge));
  const target = result?.targetBranch ?? lastMerge?.targetBranch ?? session.baseBranch;

  if (!hasChanges && !merged && phase === 'idle' && !error) return null;

  if (merged && !error) {
    const commit = result?.commit ?? lastMerge?.commit ?? null;
    const hint = phase === 'up_to_date' ? `${target} already has these changes`
      : `Merged into ${target}${commit ? ` · ${shortCommit(commit)}` : ''}`;
    return (
      <HeaderActionHint hint={hint}>
        <span role="status" aria-label={hint}
          className={buttonStyles('secondary', 'sm', cn(HEADER_ACTION_CLASS, 'cursor-default hover:bg-surface'))}>
          <Check className="size-4 text-success" />
          <span className="hidden sm:inline">{phase === 'up_to_date' ? 'Up to date' : 'Merged'}</span>
        </span>
      </HeaderActionHint>
    );
  }

  const conflicted = phase === 'conflicts' || phase === 'resolving';
  const loading = phase === 'checking' || phase === 'resolving' || phase === 'merging';
  const conflicts = result?.conflicts ?? [];
  const blocked = disabled || loading || session.status !== 'ready' || Boolean(session.pending)
    || session.deployment.state === 'starting' || !session.workspacePath;
  const label = phase === 'checking' ? 'Checking…' : phase === 'resolving' ? 'Starting…'
    : phase === 'merging' ? 'Merging…' : conflicted ? 'Resolve conflicts' : 'Merge';
  const dialogOpen = phase === 'ready' || phase === 'merging';
  const hint = dialogOpen ? null : error ?? (conflicted
    ? [`Conflicts with ${target} in ${conflicts.length} ${conflicts.length === 1 ? 'file' : 'files'}`,
      ...conflicts.slice(0, LISTED_CONFLICTS),
      ...(conflicts.length > LISTED_CONFLICTS ? [`+${conflicts.length - LISTED_CONFLICTS} more`] : [])].join('\n')
    : null);

  return (
    <>
      <HeaderActionHint hint={hint}>
        <Button variant={conflicted ? 'danger' : 'secondary'} size="sm" disabled={blocked} className={HEADER_ACTION_CLASS}
          ariaLabel={conflicted ? `Resolve conflicts with ${target}` : `Merge into ${target}`}
          onClick={() => void (conflicted ? resolve() : check())}>
          {loading ? <LoaderCircle className="size-4 animate-spin" />
            : conflicted ? <TriangleAlert className="size-4" /> : <GitMerge className="size-4" />}
          <span className="hidden sm:inline">{label}</span>
          {error ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot" /> : null}
        </Button>
      </HeaderActionHint>
      {dialogOpen ? (
        <MergeDialog targetBranch={target} branch={session.branch} changes={changes}
          merging={phase === 'merging'} error={error} onCancel={cancel} onCommit={(title) => void commit(title)} />
      ) : null}
    </>
  );
};
