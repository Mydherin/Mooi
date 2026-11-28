import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, Compass, Factory, FolderGit2, GitBranch, Globe, KeyRound, ListTodo, Lock, MessagesSquare, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { sessionPath } from '@/app/paths';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import { DevelopmentEnvironmentDialog } from '@/features/development/components/DevelopmentEnvironmentDialog';
import { FactoryPanel } from '@/features/factory/components/FactoryPanel';
import { factoryNeedsAttention } from '@/features/factory/lib/factoryNeedsAttention';
import { DeleteProjectDialog } from '@/features/projects/components/DeleteProjectDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { findProject } from '@/features/projects/lib/findProject';
import type { Project } from '@/features/projects/types/Project';
import { NewSessionDialog } from '@/features/sessions/components/NewSessionDialog';
import { SessionList } from '@/features/sessions/components/SessionList';
import { WorkspacesOverview } from '@/features/sessions/components/workspaces/WorkspacesOverview';
import { useProjectSessions } from '@/features/sessions/hooks/useProjectSessions';
import { useProjectWorkspaces } from '@/features/sessions/hooks/useProjectWorkspaces';
import { TodosPanel } from '@/features/todos/components/TodosPanel';
import { Button } from '@/shared/components/actions/Button';
import { ResponsiveActions } from '@/shared/components/actions/ResponsiveActions';
import { Badge } from '@/shared/components/data-display/Badge';
import { Initials } from '@/shared/components/data-display/Initials';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { TabPanels } from '@/shared/components/navigation/TabPanels';
import { Tabs } from '@/shared/components/navigation/Tabs';
import { useTabParam } from '@/shared/components/navigation/useTabParam';
import { useBackLink } from '@/shared/hooks/useBackLink';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatDate } from '@/shared/utils/formatDate';
import { useLiveStore } from '@/stores/liveStore';

const TABS = ['sessions', 'workspaces', 'todos', 'factory'] as const;
type ProjectTab = typeof TABS[number];
type Overlay = 'session' | 'edit' | 'environment' | 'delete' | null;

/** The repository facts, as compact chips under the title: secondary to the work below. */
const ProjectFacts = ({ project }: { project: Project }) => <>
  <Badge tone={project.isPrivate ? 'neutral' : 'info'} icon={project.isPrivate ? Lock : undefined}>{project.isPrivate ? 'Private' : 'Public'}</Badge>
  {project.webApplication ? <Badge tone="brand" icon={Globe}>Web app</Badge> : null}
  <Badge icon={GitBranch}><span className="max-w-40 truncate font-mono">{project.defaultBranch ?? '—'}</span></Badge>
  {project.language ? <Badge>{project.language}</Badge> : null}
  <Badge icon={Star}><span className="tabular-nums">{project.stars}</span></Badge>
  <Badge>Added {formatDate(project.addedAt)}</Badge>
</>;

/**
 * What Mooi knows about an imported repository: its sessions, workspaces, to-dos (the repository's own
 * `docs/TODOS.md`) and factory. Deploy and preview live inside each session, enabled by the project kind.
 * The active tab lives in `?tab=`, so a reload lands back on the same view.
 */
export const ProjectPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const back = useBackLink({ to: ROUTES.projects, label: 'Projects' });
  const { projects, status, busy, actionError: deleteError, clearActionError: clearDeleteError, remove } = useProjects();
  const project = findProject(projects, projectId);
  const { sessions, busy: sessionBusy, actionError, create, clearActionError } = useProjectSessions(project?.id);
  const { connections } = useAgentConnections();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tab, setTab] = useTabParam<ProjectTab>(TABS, 'sessions');
  const todos = useLiveStore((live) => (projectId ? live.todos[projectId] : undefined));
  const factoryAttention = useLiveStore((live) => (projectId ? factoryNeedsAttention(live.factories[projectId]) : false));
  const sessionsRevision = useMemo(
    () => sessions.map((session) => `${session.id}:${session.status}:${session.deployment.state}:${session.workspacePath ?? ''}`).join('|'),
    [sessions],
  );
  const workspaces = useProjectWorkspaces(tab === 'workspaces' ? project?.id : undefined, sessionsRevision);
  const clones = useMemo(() => sessions.filter((session) => session.workspacePath).length, [sessions]);

  if (!project) {
    return <Page>
      {status === 'loading' || status === 'idle'
        ? <div aria-busy className="flex flex-col gap-4"><Skeleton className="h-24 rounded-card" /><Skeleton className="h-64 rounded-card" /></div>
        : <EmptyState icon={Compass} title="Project not found" description="This project is not part of your workspace.">
          <Link to={ROUTES.projects} className={buttonStyles('secondary', 'md')}>Back to projects</Link>
        </EmptyState>}
    </Page>;
  }

  const close = () => setOverlay(null);
  const handleRemove = () => {
    void remove(project.id).then((removed) => { if (removed) navigate(ROUTES.projects, { replace: true }); });
  };
  const handleCreateSession = (request: Parameters<typeof create>[0]) => create(request).then((session) => {
    if (!session) return false;
    navigate(sessionPath(project.id, session.id));
    return true;
  });

  return (
    <Page>
      <PageHeader title={project.name} back={back} leading={<Initials value={project.name} size="md" />}
        subtitle={<TruncatedText text={project.description ?? project.fullName} lines={2} mono={!project.description} />}
        status={<ProjectFacts project={project} />}
        actions={<ResponsiveActions label="More project actions" actions={[
          { id: 'session', label: 'New session', icon: Plus, primary: true, variant: 'brand', onSelect: () => { clearActionError(); setOverlay('session'); } },
          { id: 'github', label: 'Open on GitHub', icon: ArrowUpRight, href: project.htmlUrl ?? undefined, hidden: !project.htmlUrl },
          { id: 'variables', label: 'Environment variables', icon: KeyRound, onSelect: () => setOverlay('environment') },
          { id: 'edit', label: 'Edit project', icon: Pencil, onSelect: () => setOverlay('edit') },
          { id: 'delete', label: 'Delete GitHub repository', icon: Trash2, destructive: true, disabled: busy, onSelect: () => { clearDeleteError(); setOverlay('delete'); } },
        ]} />}>
        <Tabs ariaLabel="Project views" idPrefix="project" value={tab} onChange={(next) => setTab(next as ProjectTab)} items={[
          { id: 'sessions', label: 'Sessions', icon: MessagesSquare, count: sessions.length },
          { id: 'workspaces', label: 'Workspaces', icon: FolderGit2, count: clones },
          // Open items, once the file was read: the tab never reaches GitHub before it is opened.
          { id: 'todos', label: 'To-dos', icon: ListTodo, count: todos?.state === 'ready' ? todos.items.filter((item) => item.status !== 'done').length : undefined },
          // The dot lights up when the factory waits for the user.
          { id: 'factory', label: 'Factory', icon: Factory, dot: factoryAttention },
        ]} />
      </PageHeader>

      <TabPanels ids={[...TABS]} value={tab} onChange={(next) => setTab(next as ProjectTab)} idPrefix="project" swipeable>
        {(id) => id === 'factory' ? <FactoryPanel project={project} />
          : id === 'todos' ? <TodosPanel projectId={project.id} branch={project.defaultBranch ?? 'the default branch'} />
            : id === 'workspaces' ? <WorkspacesOverview projectId={project.id} previewsEnabled={project.webApplication} overview={workspaces.overview}
              loading={workspaces.loading} error={workspaces.error} onReload={workspaces.reload} />
              : sessions.length > 0 ? <SessionList sessions={sessions} />
                : <EmptyState icon={MessagesSquare} title="No sessions yet"
                  description="Start one to have an agent work on this repository in its own isolated clone.">
                  <Button variant="brand" icon={Plus} onClick={() => { clearActionError(); setOverlay('session'); }}>New session</Button>
                </EmptyState>}
      </TabPanels>

      <NewSessionDialog open={overlay === 'session'} project={project} connections={connections} busy={sessionBusy} actionError={actionError}
        onClose={() => { close(); clearActionError(); }} onCreate={handleCreateSession} />
      {overlay === 'edit' ? <EditProjectDialog project={project} onClose={close} /> : null}
      {overlay === 'environment' ? <DevelopmentEnvironmentDialog projectId={project.id} onClose={close} /> : null}
      {overlay === 'delete' ? <DeleteProjectDialog project={project} busy={busy} error={deleteError} onClose={close} onDelete={handleRemove} /> : null}
    </Page>
  );
};
