import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, ListTree, RotateCw, TriangleAlert } from 'lucide-react';
import { TraceInspector } from '@/features/traces/components/TraceInspector';
import { TraceEmptyState } from '@/features/traces/components/TraceEmptyState';
import { TraceSummaryStrip } from '@/features/traces/components/TraceSummaryStrip';
import { TraceTimeline } from '@/features/traces/components/TraceTimeline';
import { TraceToolbar } from '@/features/traces/components/TraceToolbar';
import { useAgentTrace } from '@/features/traces/hooks/useAgentTrace';
import { useTraceClock } from '@/features/traces/hooks/useTraceClock';
import { useTraceKeyboard } from '@/features/traces/hooks/useTraceKeyboard';
import { buildTraceTree } from '@/features/traces/lib/buildTraceTree';
import { collectParentIds } from '@/features/traces/lib/collectParentIds';
import { flattenTraceTree } from '@/features/traces/lib/flattenTraceTree';
import { isTraceFilterActive } from '@/features/traces/lib/isTraceFilterActive';
import { traceTimeScale } from '@/features/traces/lib/traceTimeScale';
import type { TraceFilter } from '@/features/traces/types/TraceFilter';
import type { TraceView } from '@/features/traces/types/TraceView';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { IconButton } from '@/shared/components/IconButton';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { StatusDot } from '@/shared/components/StatusDot';
import { cn } from '@/shared/utils/cn';

interface TracePanelProps {
  /** The agent session whose trace is shown (dev session, production or backup chat). */
  sessionId: string;
  /** The Trace tab is visible: fetch, refresh live and listen to the keyboard only then. */
  active: boolean;
}

const EMPTY_FILTER: TraceFilter = { kinds: [], errorsOnly: false, query: '' };
const NO_COLLAPSE: ReadonlySet<string> = new Set();

const VIEWS = [
  { id: 'timeline', label: 'Timeline', icon: ListTree },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
];

/**
 * The Trace tab of an agent session: header (title, live state, view switch), KPI strip, then the
 * Timeline (toolbar + windowed span tree) or the Insights view, with the inspector beside it on
 * desktop (420px from `lg`) and as a bottom sheet on phones. State resets per session.
 */
export const TracePanel = (props: TracePanelProps) => <TracePanelBody key={props.sessionId} {...props} />;

const TracePanelBody = ({ sessionId, active }: TracePanelProps) => {
  const { trace, error, loading, live, refresh } = useAgentTrace(sessionId, active);
  const [view, setView] = useState<TraceView>('timeline');
  const [filter, setFilter] = useState<TraceFilter>(EMPTY_FILTER);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_COLLAPSE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const spans = trace?.spans;
  const roots = useMemo(() => buildTraceTree(spans ?? []), [spans]);
  const filtering = isTraceFilterActive(filter);
  const rows = useMemo(() => flattenTraceTree(roots, collapsed, filter), [roots, collapsed, filter]);
  const running = useMemo(() => live && (spans ?? []).some((span) => span.status === 'running'), [live, spans]);
  const now = useTraceClock(active && running);

  const summary = trace?.summary;
  const startMs = summary?.startMs ?? now;
  const endMs = live ? Math.max(now, summary?.endMs ?? now) : (summary?.endMs ?? startMs);
  const scale = useMemo(() => traceTimeScale(startMs, endMs), [startMs, endMs]);

  const selectedSpan = useMemo(
    () => (selectedId ? spans?.find((span) => span.id === selectedId) ?? null : null),
    [selectedId, spans],
  );

  const setNodeCollapsed = useCallback((spanId: string, value: boolean) => {
    setCollapsed((current) => {
      if (current.has(spanId) === value) return current;
      const next = new Set(current);
      if (value) next.add(spanId);
      else next.delete(spanId);
      return next;
    });
  }, []);
  const toggle = useCallback((spanId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(spanId)) next.add(spanId);
      return next;
    });
  }, []);
  const openSpan = useCallback((spanId: string) => {
    setSelectedId(spanId);
    setInspectorOpen(true);
  }, []);
  const closeInspector = useCallback(() => setInspectorOpen(false), []);

  useTraceKeyboard({
    enabled: active && view === 'timeline',
    rows,
    selectedId,
    collapsed: filtering ? NO_COLLAPSE : collapsed,
    onSelect: setSelectedId,
    onCollapsedChange: (spanId, value) => {
      if (!filtering) setNodeCollapsed(spanId, value);
    },
    onOpen: openSpan,
    onClose: closeInspector,
  });

  // The inspector: the 420px column below from `lg`, a portal bottom sheet on phones.
  const inspector: ReactNode = trace && inspectorOpen && selectedSpan ? (
    <TraceInspector
      sessionId={sessionId}
      span={selectedSpan}
      revision={trace.revision}
      traceStartMs={trace.summary.startMs}
      now={now}
      rows={rows}
      onSelect={setSelectedId}
      onClose={closeInspector}
    />
  ) : null;

  /*
   * F5 slot — the Insights view: replace this placeholder with
   *   <TraceInsights trace={trace} onOpenSpan={(spanId) => { setView('timeline'); openSpan(spanId); }} />
   */
  const insights: ReactNode = (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
      <EmptyState icon={BarChart3} title="Insights" description="Context size per request, tokens per model and tool rankings." />
    </div>
  );

  if (!trace) {
    return (
      <section aria-label="Agent trace" className="flex h-full min-h-0 flex-col bg-surface">
        {error ? <TraceEmptyState kind="error" message={error} onAction={refresh} /> : <TraceEmptyState kind={loading || active ? 'loading' : 'empty'} />}
      </section>
    );
  }

  const timeline = rows.length > 0 ? (
    <TraceTimeline
      rows={rows}
      scale={scale}
      now={now}
      selectedId={selectedId}
      collapsed={filtering ? NO_COLLAPSE : collapsed}
      onSelect={openSpan}
      onToggle={filtering ? () => undefined : toggle}
    />
  ) : trace.spans.length > 0 ? (
    <TraceEmptyState kind="noMatch" onAction={() => setFilter(EMPTY_FILTER)} />
  ) : (
    <TraceEmptyState kind="empty" />
  );

  return (
    <section aria-label="Agent trace" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {live ? <StatusDot tone="success" pulse /> : null}
          <span className="min-w-0 truncate text-sm font-semibold text-ink" title={trace.title ?? undefined}>
            {trace.title ?? 'Agent trace'}
          </span>
          {trace.conversations > 1 ? (
            <span className="hidden shrink-0 rounded-full bg-surface-2 px-2 py-px text-[11px] font-medium text-ink-muted sm:inline">
              {trace.conversations} conversations
            </span>
          ) : null}
        </div>
        <SegmentedControl items={VIEWS} value={view} onChange={(id) => setView(id as TraceView)} className="shrink-0 flex-nowrap" />
        <IconButton icon={RotateCw} label="Refresh trace" onClick={refresh} className={cn('hidden sm:inline-flex', loading && '[&>svg]:animate-spin')} />
      </header>

      <div className="shrink-0 border-b border-line">
        <TraceSummaryStrip summary={trace.summary} live={live} now={now} />
      </div>

      {trace.truncated ? (
        <p role="status" className="flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-[12px] text-warning">
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="min-w-0">The trace reached its step limit: the oldest steps are not shown.</span>
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="flex shrink-0 items-center gap-3 border-b border-danger/30 bg-danger-soft px-4 py-2 text-[12px] text-danger">
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <Button variant="danger" size="sm" onClick={refresh}>
            <RotateCw className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      <div className={cn('grid min-h-0 flex-1 grid-cols-1', inspector ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : null)}>
        <div className="flex min-h-0 min-w-0 flex-col">
          {view === 'timeline' ? (
            <>
              <div className="shrink-0 border-b border-line">
                <TraceToolbar
                  filter={filter}
                  onFilterChange={setFilter}
                  counts={trace.summary.counts}
                  errors={trace.summary.errors}
                  onExpandAll={() => setCollapsed(NO_COLLAPSE)}
                  onCollapseAll={() => setCollapsed(collectParentIds(roots))}
                />
              </div>
              {timeline}
            </>
          ) : (
            insights
          )}
        </div>
        {inspector}
      </div>
    </section>
  );
};
