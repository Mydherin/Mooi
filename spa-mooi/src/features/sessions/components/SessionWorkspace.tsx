import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { GitCompareArrows, MessagesSquare, Monitor } from 'lucide-react';
import { PreviewPanel } from './preview/PreviewPanel';
import { Tabs } from '@/shared/components/Tabs';
import type { TabItem } from '@/shared/types/TabItem';
import { DeployLogsDrawer } from './deploy/DeployLogsDrawer';
import { useSessionsStore } from '@/stores/sessionsStore';
import { cn } from '@/shared/utils/cn';

const ChangesPanel = lazy(() => import('./changes/ChangesPanel').then((module) => ({ default: module.ChangesPanel })));

export const SessionWorkspace = ({ sessionId, children }: { sessionId: string; children: ReactNode }) => {
  const pane = useSessionsStore((state) => state.byId[sessionId]?.pane ?? 'conversation');
  const setPane = useSessionsStore((state) => state.setPane);
  const logsOpen = useSessionsStore((state) => state.byId[sessionId]?.deploymentLogsOpen ?? false);
  const [visitedOperation, setVisitedOperation] = useState<string | null>(null);
  const changes = useSessionsStore((state) => state.byId[sessionId]?.changes);
  const deployment = useSessionsStore((state) => state.sessions.find((session) => session.id === sessionId)?.deployment);
  const openedOperation = useSessionsStore((state) => state.byId[sessionId]?.previewOpenedOperationId);
  const operationId = deployment?.operationId;
  const running = deployment?.state === 'running';
  const hasPreview = Boolean(operationId);

  useEffect(() => () => useSessionsStore.getState().setDeploymentLogsOpen(sessionId, false), [sessionId]);

  useEffect(() => {
    if (running && operationId && openedOperation !== operationId) {
      useSessionsStore.getState().markPreviewOpened(sessionId, operationId);
      setVisitedOperation(operationId);
      setPane(sessionId, 'preview');
    }
  }, [running, operationId, openedOperation, sessionId, setPane]);

  const selectPane = (id: string) => {
    if (id !== 'conversation' && id !== 'changes' && id !== 'preview') return;
    setPane(sessionId, id);
    if (id === 'preview' && running && operationId) setVisitedOperation(operationId);
  };

  const items: TabItem[] = [
    { id: 'conversation', label: 'Conversation', icon: MessagesSquare },
    { id: 'changes', label: 'Changes', icon: GitCompareArrows, count: changes?.files.length ?? 0 },
    ...(hasPreview ? [{ id: 'preview', label: 'Preview', icon: Monitor, dot: running }] : []),
  ];
  const visiblePane = pane === 'preview' && !hasPreview ? 'conversation' : pane;
  const keepPreview = visiblePane === 'preview' || (running && visitedOperation === operationId);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-5">
        <Tabs items={items} value={visiblePane} onChange={selectPane} ariaLabel="Session view" />
        {visiblePane === 'conversation' ? <span className="hidden text-[11px] text-ink-subtle sm:block">Live</span> : null}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1">
        <section role="tabpanel" aria-label="Conversation" hidden={visiblePane !== 'conversation'}
          className={cn('min-h-0 min-w-0', visiblePane !== 'conversation' && 'hidden')}>{children}</section>
        {visiblePane === 'changes' ? <section role="tabpanel" id="session-changes" aria-label="Live code changes" className="min-h-0 min-w-0">
          <Suspense fallback={<p className="p-6 text-sm text-ink-muted">Loading changes…</p>}><ChangesPanel sessionId={sessionId} /></Suspense>
        </section> : null}
        {keepPreview && deployment ? <section role="tabpanel" aria-label="Application preview" hidden={visiblePane !== 'preview'}
          className={cn('min-h-0 min-w-0', visiblePane !== 'preview' && 'hidden')}>
          <PreviewPanel sessionId={sessionId} deployment={deployment} visible={visiblePane === 'preview'} />
        </section> : null}
      </div>
      {logsOpen ? <DeployLogsDrawer sessionId={sessionId} /> : null}
    </div>
  );
};
