import { useMemo, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, FolderGit2 } from 'lucide-react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectTodosSection } from '@/features/todos/components/ProjectTodosSection';
import { TodoProjectFilter } from '@/features/todos/components/TodoProjectFilter';
import { countTodos } from '@/features/todos/lib/countTodos';
import { expandedTodoProjects } from '@/features/todos/lib/expandedTodoProjects';
import { Button } from '@/shared/components/actions/Button';
import { CompactNumber } from '@/shared/components/data-display/CompactNumber';
import { Stat } from '@/shared/components/data-display/Stat';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';
import { useAuthStore } from '@/stores/authStore';
import { useLiveStore } from '@/stores/liveStore';
import { useTodoProjectSelectionStore } from '@/stores/todoProjectSelectionStore';

/**
 * Every project's to-do list on one page, each expanding into the same editor as the project's own
 * tab, so the player follows and moves work forward across the workspace without switching
 * projects. Each list is still its repository's `docs/TODOS.md`, read and committed per project.
 */
export const TodosPage = () => {
  const { projects, status, error, reload } = useProjects();
  const todos = useLiveStore((live) => live.todos);
  const playerId = useAuthStore((state) => state.player?.id);
  const selection = useTodoProjectSelectionStore((state) => playerId ? state.selections[playerId] : undefined);
  const select = useTodoProjectSelectionStore((state) => state.select);
  const [expanded, setExpanded] = useState(() => new Set(expandedTodoProjects.read()));

  const selectedIds = useMemo(() => new Set(selection ?? projects.map((project) => project.id)), [selection, projects]);
  const visibleProjects = useMemo(() => projects.filter((project) => selectedIds.has(project.id)), [projects, selectedIds]);

  // Lists read so far: each one is read once its row nears the screen.
  const totals = useMemo(() => countTodos(visibleProjects.flatMap((project) =>
    (todos[project.id]?.state === 'ready' ? todos[project.id].items : []))), [visibleProjects, todos]);

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
    <Page width="default">
      <PageHeader title="To-dos" eyebrow="Workspace"
        subtitle="Choose the projects you want to see. Expand a project to add, start, complete and reorder its items.">
        {projects.length > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <TodoProjectFilter projects={projects} selectedIds={selectedIds}
              onChange={(ids) => { if (playerId) select(playerId, ids); }} />
            <Button variant="ghost" size="sm" icon={allExpanded ? ChevronsDownUp : ChevronsUpDown} onClick={toggleAll}
              disabled={visibleProjects.length === 0} className="ml-auto shrink-0">
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          </div>
        ) : null}
      </PageHeader>

      <PageSection className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="In progress" value={<CompactNumber value={totals.inProgress} />} tone="info" />
          <Stat label="To do" value={<CompactNumber value={totals.open} />} />
          <Stat label="Done" value={<CompactNumber value={totals.done} />} tone="success" />
        </div>

        {error ? <ErrorState description={error} onRetry={reload} /> : null}

        {(status === 'loading' || status === 'idle') && projects.length === 0 ? (
          <div aria-busy className="flex flex-col gap-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 rounded-card" />)}</div>
        ) : projects.length === 0 ? (
          !error && <EmptyState icon={FolderGit2} title="No projects yet" description="Add a project to your workspace to plan its work here." />
        ) : visibleProjects.length === 0 ? (
          <EmptyState icon={FolderGit2} title="No projects selected" description="Choose projects from the Projects dropdown to see their to-dos." />
        ) : (
          <ul aria-label="Projects" className="flex flex-col gap-3">
            {visibleProjects.map((project) => (
              <ProjectTodosSection key={project.id} project={project}
                expanded={expanded.has(project.id)} onToggle={() => toggle(project.id)} />
            ))}
          </ul>
        )}
      </PageSection>
    </Page>
  );
};
