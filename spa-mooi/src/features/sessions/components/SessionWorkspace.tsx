import { lazy, Suspense, useState, type ReactNode } from 'react';
import { GitCompareArrows, MessagesSquare } from 'lucide-react';
import { Tabs } from '@/shared/components/Tabs';
import type { TabItem } from '@/shared/types/TabItem';
import { useSessionsStore } from '@/stores/sessionsStore';
import { cn } from '@/shared/utils/cn';

const ChangesPanel = lazy(() => import('./changes/ChangesPanel').then((module) => ({ default: module.ChangesPanel })));

export const SessionWorkspace = ({ sessionId, children }: { sessionId: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const changes = useSessionsStore((state) => state.byId[sessionId]?.changes);

  const items: TabItem[] = [
    { id: 'conversation', label: 'Conversation', icon: MessagesSquare },
    { id: 'changes', label: 'Changes', icon: GitCompareArrows, count: changes?.files.length ?? 0 },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-5">
        <Tabs
          items={items}
          value={open ? 'changes' : 'conversation'}
          onChange={(id) => setOpen(id === 'changes')}
          ariaLabel="Session view"
        />
        {open ? null : <span className="hidden text-[11px] text-ink-subtle sm:block">Live</span>}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1">
        <div className={cn('min-h-0 min-w-0', open && 'hidden')}>{children}</div>
        {open ? <section id="session-changes" aria-label="Live code changes" className="min-h-0 min-w-0">
          <Suspense fallback={<p className="p-6 text-sm text-ink-muted">Loading changes…</p>}><ChangesPanel sessionId={sessionId} /></Suspense>
        </section> : null}
      </div>
    </div>
  );
};
