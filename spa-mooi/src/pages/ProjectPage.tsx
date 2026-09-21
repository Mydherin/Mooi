import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CloudUpload, Compass, MessagesSquare } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { sessionPath } from '@/app/paths';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { findProject } from '@/features/projects/lib/findProject';
import { NewSessionDialog } from '@/features/sessions/components/NewSessionDialog';
import { SessionList } from '@/features/sessions/components/SessionList';
import { useProjectSessions } from '@/features/sessions/hooks/useProjectSessions';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/components/Button';
import { buttonStyles } from '@/shared/styles/buttonStyles';

/**
 * What Mooi knows about an imported repository, and nothing it does not.
 *
 * Deployments render as an empty state rather than as sample rows: a repository added a minute ago
 * has none, and inventing one would make the screen lie about work that never ran.
 */
export const ProjectPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, status, busy, remove } = useProjects();
  const project = findProject(projects, projectId);
  const { sessions, busy: sessionBusy, actionError, create, clearActionError } = useProjectSessions(project?.id);
  const { connections } = useAgentConnections();
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  if (!project) {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
          <Card className="h-44 animate-pulse-soft" />
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <EmptyState
          icon={Compass}
          title="Project not found"
          description="This project is not part of your workspace."
        >
          <Link to={ROUTES.projects} className={buttonStyles('secondary', 'md')}>
            Back to projects
          </Link>
        </EmptyState>
      </div>
    );
  }

  const handleRemove = () => {
    void remove(project.id).then((removed) => {
      if (removed) {
        navigate(ROUTES.projects, { replace: true });
      }
    });
  };

  const handleCreateSession = (request: Parameters<typeof create>[0]) =>
    create(request).then((session) => {
      if (session) {
        navigate(sessionPath(project.id, session.id));
        return true;
      }

      return false;
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
      <ProjectHeader
        project={project}
        busy={busy}
        onRemove={handleRemove}
        onNewSession={() => setNewSessionOpen(true)}
      />

      {sessions.length > 0 ? (
        <SessionList sessions={sessions} />
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="No sessions yet"
          description="Start one to have an agent work on this repository."
        />
      )}

      <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface-2 px-5 py-4 sm:flex-row sm:items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-ink-subtle">
          <CloudUpload className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
            Deployments
            <span className="text-[9px] font-extrabold tracking-[0.06em] text-ink-subtle uppercase">
              Not operational
            </span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-subtle">
            The concept exists, but no deployment runs yet. This stays empty on purpose rather than
            showing work that never happened.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled>
          Deploy
        </Button>
      </div>

      <NewSessionDialog
        open={newSessionOpen}
        project={project}
        connections={connections}
        busy={sessionBusy}
        actionError={actionError}
        onClose={() => {
          setNewSessionOpen(false);
          clearActionError();
        }}
        onCreate={handleCreateSession}
      />
    </div>
  );
};
