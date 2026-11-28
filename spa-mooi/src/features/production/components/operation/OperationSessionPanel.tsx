import { lazy, Suspense } from 'react';
import { Spinner } from '@/shared/components/feedback/Spinner';

const ChangesPanel = lazy(() => import('@/features/sessions/components/changes/ChangesPanel').then((module) => ({ default: module.ChangesPanel })));
const TracePanel = lazy(() => import('@/features/traces/components/TracePanel').then((module) => ({ default: module.TracePanel })));

interface OperationSessionPanelProps {
  view: 'changes' | 'trace';
  sessionId: string;
  /** What the Changes view says while the chat changed nothing in the repository. */
  changesDescription: string;
}

/** The chat's repository changes or its trace, loaded only when opened. */
export const OperationSessionPanel = ({ view, sessionId, changesDescription }: OperationSessionPanelProps) => (
  <Suspense fallback={<div className="flex h-full items-center justify-center text-ink-muted"><Spinner label={view === 'changes' ? 'Loading changes…' : 'Loading trace…'} /></div>}>
    {view === 'changes' ? <ChangesPanel sessionId={sessionId} showMerge={false} emptyDescription={changesDescription} />
      : <TracePanel key={sessionId} sessionId={sessionId} active />}
  </Suspense>
);
