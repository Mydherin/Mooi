import { useCallback, useEffect, useState } from 'react';
import { GitCompare, LoaderCircle, RotateCw } from 'lucide-react';
import { fetchChanges } from '@/features/sessions/api/sessionsApi';
import { ChangedFileRow } from '@/features/sessions/components/changes/ChangedFileRow';
import { ChangesSummary } from '@/features/sessions/components/changes/ChangesSummary';
import { DiffView } from '@/features/sessions/components/changes/DiffView';
import { EmptyState } from '@/shared/components/EmptyState';
import { useSessionsStore } from '@/stores/sessionsStore';
import { Button } from '@/shared/components/Button';

interface ChangesPanelProps {
  sessionId: string;
}

export const ChangesPanel = ({ sessionId }: ChangesPanelProps) => {
  const changes = useSessionsStore((state) => state.byId[sessionId]?.changes ?? null);
  const changesStatus = useSessionsStore((state) => state.byId[sessionId]?.changesStatus ?? 'idle');
  const changesError = useSessionsStore((state) => state.byId[sessionId]?.changesError ?? null);
  const lastSeq = useSessionsStore((state) => state.byId[sessionId]?.lastSeq ?? 0);
  const files = changes?.files ?? [];
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);

  const retry = useCallback(async () => {
    const requestSeq = useSessionsStore.getState().byId[sessionId]?.lastSeq ?? lastSeq;
    useSessionsStore.getState().setChangesLoading(sessionId);
    try {
      const next = await fetchChanges(sessionId);
      useSessionsStore.getState().setChanges(sessionId, next, requestSeq);
    } catch (failure) {
      useSessionsStore.getState().setChangesError(sessionId, (failure as Error).message, requestSeq);
    }
  }, [lastSeq, sessionId]);

  useEffect(() => {
    if (!files.some((file) => file.path === selectedPath)) {
      setSelectedPath(files[0]?.path ?? null);
    }
  }, [files, selectedPath]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <ChangesSummary summary={changes} />

      {changesStatus === 'error' ? (
        <div role="alert" className="flex shrink-0 items-center gap-3 border-b border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          <span className="min-w-0 flex-1 break-words">{changesError ?? 'Could not load changes.'}</span>
          <Button variant="danger" size="sm" onClick={() => void retry()}>
            <RotateCw className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      {changesStatus === 'loading' && files.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <EmptyState
            icon={LoaderCircle}
            title="Loading changes…"
            description="Reading changes in this session."
          />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <EmptyState
            icon={GitCompare}
            title="No changes yet"
            description="Once the agent edits files on this branch, they will show up here."
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)] lg:grid-rows-1">
          <ul className="min-w-0 max-h-44 overflow-y-auto border-b border-line p-1.5 lg:max-h-none lg:border-r lg:border-b-0">
            {files.map((file) => (
              <ChangedFileRow
                key={file.path}
                file={file}
                selected={file.path === selectedPath}
                onSelect={setSelectedPath}
              />
            ))}
          </ul>

          <div className="relative flex min-w-0 min-h-0 flex-col">
            {changesStatus === 'loading' ? <p role="status" className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-muted shadow-sm"><LoaderCircle className="size-3 animate-spin" />Refreshing</p> : null}
            {selectedPath ? <DiffView key={selectedPath} sessionId={sessionId} path={selectedPath} /> : null}
          </div>
        </div>
      )}
    </div>
  );
};
