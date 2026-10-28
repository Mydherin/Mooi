import { useMemo, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, FolderGit2 } from 'lucide-react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectTodosSection } from '@/features/todos/components/ProjectTodosSection';
import { countTodos } from '@/features/todos/lib/countTodos';
import { expandedTodoProjects } from '@/features/todos/lib/expandedTodoProjects';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { formatCount } from '@/shared/utils/formatCount';
import { useLiveStore } from '@/stores/liveStore';

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <dt className="font-mono text-[10.5px] font-medium tracking-[0.12em] text-ink-subtle uppercase">{label}</dt>
    <dd className="text-xl font-extrabold text-ink tabular-nums" title={value >= 1000 ? value.toLocaleString('en') : undefined}>
      {formatCount(value)}
    </dd>
  </div>
);

/**
 * Every project's to-do list on one page, each expanding into the same editor as the project's own
 * tab, so the player follows and moves work forward across the workspace without switching
 * projects. Each list is still its repository's `docs/TODOS.md`, read and committed per project.
 */
export const TodosPage = () => {
  const { projects, status, error, reload } = useProjects();
  const todos = useLiveStore((live) => live.todos);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set(expandedTodoProjects.read()));

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? projects.filter((project) => project.fullName.toLowerCase().includes(term)) : projects;
  }, [projects, query]);

  // Lists read so far: each one is read once its row nears the screen.
  const totals = useMemo(() => countTodos(projects.flatMap((project) =>
    (todos[project.id]?.state === 'ready' ? todos[project.id].items : []))), [projects, todos]);

  const remember = (next: Set<string>) => {
    setExpanded(next);
    expandedTodoProjects.write([...next]);
  };
  const toggle = (projectId: string) => {
    const next = new Set(expanded);
    if (!next.delete(projectId)) next.add(projectId);
    remember(next);
  };
  const allExpanded = visibleProjects.length > 0 && visibleProjects.every((project) => expanded.has(project.id));
  const toggleAll = () => {
    const next = new Set(expanded);
    visibleProjects.forEach((project) => (allExpanded ? next.delete(project.id) : next.add(project.id)));
    remember(next);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pt-7 pb-[calc(1.75rem+var(--safe-bottom))] sm:px-8 lg:px-10 lg:pt-10 lg:pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[10.5px] font-medium tracking-[0.12em] text-ink-subtle uppercase">Workspace</p>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">To-dos</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Every project’s to-do list in one place. Expand a project to add, start, complete and reorder its items.
          </p>
        </div>
        <dl className="flex gap-6">
          <Stat label="In progress" value={totals.inProgress} />
          <Stat label="To do" value={totals.open} />
          <Stat label="Done" value={totals.done} />
        </dl>
      </header>

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <span>{error}</span><Button variant="secondary" size="sm" onClick={reload}>Retry</Button>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="flex items-center gap-2">
          {projects.length > 6 ? <SearchInput value={query} onChange={setQuery} placeholder="Search projects" className="sm:max-w-sm" /> : null}
          <Button variant="ghost" size="sm" onClick={toggleAll} disabled={visibleProjects.length === 0} className="ml-auto shrink-0">
            {allExpanded ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      ) : null}

      {(status === 'loading' || status === 'idle') && projects.length === 0 ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((item) => <Card key={item} className="h-16 animate-pulse-soft" />)}</div>
      ) : projects.length === 0 ? (
        !error && <EmptyState icon={FolderGit2} title="No projects yet" description="Add a project to your workspace to plan its work here." />
      ) : visibleProjects.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">No project matches “{query}”.</p>
      ) : (
        <ul aria-label="Projects" className="flex flex-col gap-3">
          {visibleProjects.map((project) => (
            <ProjectTodosSection key={project.id} project={project}
              expanded={expanded.has(project.id)} onToggle={() => toggle(project.id)} />
          ))}
        </ul>
      )}
    </div>
  );
};
