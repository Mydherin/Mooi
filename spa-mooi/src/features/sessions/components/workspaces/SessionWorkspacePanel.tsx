import { HardDrive } from 'lucide-react';
import { WorkspaceCard } from '@/features/sessions/components/workspaces/WorkspaceCard';
import { useProjectWorkspaces } from '@/features/sessions/hooks/useProjectWorkspaces';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { shortenPath } from '@/shared/utils/shortenPath';

interface SessionWorkspacePanelProps {
  projectId: string;
  sessionId: string;
  previewsEnabled: boolean;
  /** Changes whenever the clone may have changed on disk (status, changed files), so it is read again. */
  revision: string;
}

/** Where the session lives on disk: its clone, branch, commit, uncommitted files and size, read fresh from `mic-sessions`. */
export const SessionWorkspacePanel = ({ projectId, sessionId, previewsEnabled, revision }: SessionWorkspacePanelProps) => {
  const { overview, loading, error, reload } = useProjectWorkspaces(projectId, revision);
  const workspace = overview?.workspaces.find((item) => item.sessionId === sessionId);

  return (
    <div data-scroller className="h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-gutter py-5 pb-[calc(1.25rem+var(--safe-bottom))]">
        {error && !overview ? <ErrorState description={error} onRetry={reload} retrying={loading} />
          : !overview ? <Skeleton className="h-56 rounded-card" />
            : workspace ? (
              <>
                <ul aria-label="Session workspace"><WorkspaceCard projectId={projectId} workspace={workspace} previewsEnabled={previewsEnabled} linked={false} /></ul>
                <p className="text-caption text-ink-subtle">Every clone of this project lives under <span className="font-mono">{shortenPath(overview.root)}</span>.</p>
              </>
            ) : <EmptyState icon={HardDrive} title="No clone yet" description="The workspace appears here as soon as the session's repository is cloned." />}
      </div>
    </div>
  );
};
