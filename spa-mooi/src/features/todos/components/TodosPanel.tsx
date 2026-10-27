import { useMemo, useState } from 'react';
import { CircleCheckBig, ExternalLink, ListTodo, RefreshCw } from 'lucide-react';
import { TodoComposer } from '@/features/todos/components/TodoComposer';
import { TodoSortableList } from '@/features/todos/components/TodoSortableList';
import { TodosCleanupDialog } from '@/features/todos/components/TodosCleanupDialog';
import { TodosUnsupported } from '@/features/todos/components/TodosUnsupported';
import { TodoSyncIndicator } from '@/features/todos/components/TodoSyncIndicator';
import { useProjectTodos } from '@/features/todos/hooks/useProjectTodos';
import { keptTodosRevision } from '@/features/todos/lib/keptTodosRevision';
import type { TodoFilter } from '@/features/todos/types/TodoFilter';
import type { TodoStatus } from '@/features/todos/types/TodoStatus';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Eyebrow } from '@/shared/components/Eyebrow';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { cn } from '@/shared/utils/cn';

const emptyFilter: Record<TodoFilter, string> = {
  all: 'All clear',
  open: 'Everything is started',
  inProgress: 'Nothing in progress',
  done: 'Nothing completed yet',
};

interface TodosPanelProps {
  projectId: string;
  branch: string;
}

/**
 * The project's to-do list, a view over `docs/TODOS.md` on the default branch: every change is a
 * commit there, and changes made anywhere else (another device, an agent) show up live. Mounted
 * only while its tab is open, so the GitHub read happens when the list is actually looked at.
 */
export const TodosPanel = ({ projectId, branch }: TodosPanelProps) => {
  const { list, items, loadError, saveError, status, change, reload } = useProjectTodos(projectId);
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [cleaning, setCleaning] = useState(false);
  const [keptRevision, setKeptRevision] = useState(() => keptTodosRevision.read(projectId));

  const counts = useMemo(() => {
    const total: Record<TodoStatus, number> = { open: 0, inProgress: 0, done: 0 };
    for (const item of items) total[item.status] += 1;
    return total;
  }, [items]);
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.status === filter)),
    [items, filter],
  );
  const texts = useMemo(() => items.map((item) => item.text), [items]);

  if (!list) {
    if (loadError) {
      return <EmptyState icon={ListTodo} title="To-do list unavailable" description={loadError} />;
    }
    return (
      <Card className="flex flex-col gap-3 p-5">
        <div className="h-5 w-40 animate-pulse-soft rounded bg-surface-2" />
        <div className="h-11 animate-pulse-soft rounded-control bg-surface-2" />
        {[0, 1, 2].map((index) => <div key={index} className="h-9 animate-pulse-soft rounded bg-surface-2" />)}
      </Card>
    );
  }

  const keep = () => {
    keptTodosRevision.write(projectId, list.revision);
    setKeptRevision(list.revision);
  };

  const cleanUp = () => {
    setCleaning(false);
    keptTodosRevision.write(projectId, null);
    setKeptRevision(null);
    change({ kind: 'replace', items: list.salvage });
  };

  const share = (count: number) => (items.length === 0 ? 0 : (count / items.length) * 100);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Eyebrow>Kept in the repository</Eyebrow>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-ink-subtle">
            {list.htmlUrl && list.state !== 'missing' ? (
              <a href={list.htmlUrl} target="_blank" rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 rounded transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span className="truncate">{list.path}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : <span className="truncate">{list.path}</span>}
            <span aria-hidden>·</span>
            <span className="truncate">{branch}</span>
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <TodoSyncIndicator status={status} branch={branch} />
          <button
            type="button"
            onClick={reload}
            disabled={status === 'saving'}
            aria-label="Reload from GitHub"
            title="Reload from GitHub"
            className="inline-flex size-8 items-center justify-center rounded-control border border-line text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {saveError ? (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
          {saveError} The list shows the latest version from GitHub.
        </p>
      ) : null}

      {list.state === 'unsupported' && status !== 'saving' ? (
        <TodosUnsupported list={list} kept={keptRevision === list.revision}
          onCleanUp={() => setCleaning(true)} onKeep={keep} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-ink">{list.title}</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {items.length === 0 ? 'Nothing planned yet' : `${counts.done} of ${items.length} done`}
                  {counts.inProgress > 0 ? ` · ${counts.inProgress} in progress` : null}
                </p>
              </div>
              {items.length > 0 ? (
                <SegmentedControl
                  value={filter}
                  onChange={(next) => setFilter(next as TodoFilter)}
                  items={[
                    { id: 'all', label: `All ${items.length}` },
                    { id: 'inProgress', label: `In progress ${counts.inProgress}` },
                    { id: 'open', label: `To do ${counts.open}` },
                    { id: 'done', label: `Done ${counts.done}` },
                  ]}
                />
              ) : null}
            </div>
            {items.length > 0 ? (
              <div aria-hidden className="flex h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-success-dot transition-[width] duration-500 ease-out-expo" style={{ width: `${share(counts.done)}%` }} />
                <div className="h-full bg-info-dot/60 transition-[width] duration-500 ease-out-expo" style={{ width: `${share(counts.inProgress)}%` }} />
              </div>
            ) : null}
            <TodoComposer existing={texts} disabled={list.state === 'unsupported'}
              onAdd={(text) => change({ kind: 'add', text })} />
          </div>

          {visible.length > 0 ? (
            <TodoSortableList items={visible} texts={texts} locked={list.state === 'unsupported'} change={change} />
          ) : (
            <div className="flex flex-col items-center border-t border-line px-6 py-10 text-center">
              <span className={cn('flex size-10 items-center justify-center rounded-xl border border-line bg-surface shadow-raised',
                items.length > 0 ? 'text-success-dot' : 'text-ink-muted')}>
                {items.length > 0 ? <CircleCheckBig className="size-5" /> : <ListTodo className="size-5" />}
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">
                {items.length === 0 ? (list.state === 'missing' ? 'Start the project’s to-do list' : 'All clear')
                  : emptyFilter[filter]}
              </p>
              <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                {list.state === 'missing'
                  ? `Add a first item: Mooi creates ${list.path} on ${branch} and commits every change you make.`
                  : 'Items you add here are committed to the repository, and agents can manage them from any session chat.'}
              </p>
            </div>
          )}
        </Card>
      )}

      {cleaning ? (
        <TodosCleanupDialog list={list} branch={branch} onClose={() => setCleaning(false)} onConfirm={cleanUp} />
      ) : null}
    </section>
  );
};
