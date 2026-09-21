import { Link, useNavigate, useParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { projectPath } from '@/app/paths';
import { ROUTES } from '@/app/routes';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { findProject } from '@/features/projects/lib/findProject';
import { ChatPanel } from '@/features/sessions/components/chat/ChatPanel';
import { SessionWorkspace } from '@/features/sessions/components/SessionWorkspace';
import { WorkspaceHeader } from '@/features/sessions/components/WorkspaceHeader';
import { useProjectSessions } from '@/features/sessions/hooks/useProjectSessions';
import { useSession } from '@/features/sessions/hooks/useSession';
import { useSessionStream } from '@/features/sessions/hooks/useSessionStream';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useSessionsStore } from '@/stores/sessionsStore';

export const SessionPage = () => {
  const { projectId, sessionId } = useParams();
  const navigate = useNavigate();
  const { projects, status: projectsStatus } = useProjects();
  const project = findProject(projects, projectId);
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    busy,
    actionError,
    send,
    interrupt,
    allowPermission,
    denyPermission,
    answer,
    modelOptions,
    modelLoading,
    modelError,
    updateConfiguration,
  } = useSession(sessionId);
  useSessionStream(sessionId);
  const { close, busy: closing } = useProjectSessions(projectId);
  const transcript = useSessionsStore((state) => (sessionId ? state.byId[sessionId] : undefined));

  if (!project || !session) {
    const stillLoading = projectsStatus === 'loading' || projectsStatus === 'idle' || sessionLoading;

    if (stillLoading) {
      return (
        <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-6 lg:px-6">
          <Card className="h-16 shrink-0 animate-pulse-soft" />
          <Card className="min-h-0 flex-1 animate-pulse-soft" />
        </div>
      );
    }

    return (
      <div className="px-4 py-8 lg:px-6">
        <EmptyState
          icon={Compass}
          title="Session not found"
          description={sessionError ?? 'This session is not part of your workspace.'}
        >
          <Link
            to={project ? projectPath(project.id) : ROUTES.projects}
            className={buttonStyles('secondary', 'md')}
          >
            Back to {project ? 'project' : 'projects'}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const isTerminal = session.status === 'failed' || session.status === 'closed';
  const entries = transcript?.entries ?? [];
  const pending = transcript?.pending ?? [];
  const streamState = transcript?.streamState ?? 'closed';

  const handleClose = () => {
    void close(session.id).then((closed) => {
      if (closed) {
        navigate(projectPath(project.id), { replace: true });
      }
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceHeader
        project={project}
        session={session}
        onClose={handleClose}
        closeBusy={closing}
      />

      {isTerminal ? (
        <div role="status" className="max-h-[30dvh] shrink-0 overflow-y-auto border-b border-line bg-surface-2 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm font-extrabold text-ink">{session.status === 'failed' ? 'This session failed' : 'This session is closed'}</p>
              <p className="mt-1 break-words text-sm text-ink-muted">{session.detail ?? 'Your conversation is available below. Start a new session to continue.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={projectPath(project.id)} className={buttonStyles('secondary', 'sm')}>Back to project</Link>
            </div>
          </div>
        </div>
      ) : null}
      <SessionWorkspace key={session.id} sessionId={session.id}>
        <ChatPanel
          session={session}
          entries={entries}
          pending={pending}
          streamState={streamState}
          busy={busy}
          modelOptions={modelOptions}
          modelLoading={modelLoading}
          modelError={modelError}
          actionError={actionError}
          onSend={send}
          onInterrupt={interrupt}
          onConfigurationChange={(configuration) => void updateConfiguration(configuration)}
          onAllowPermission={(requestId, updatedInput) => void allowPermission(requestId, updatedInput)}
          onDenyPermission={(requestId, message) => void denyPermission(requestId, message)}
          onAnswerQuestion={(requestId, answers) => void answer(requestId, answers)}
        />
      </SessionWorkspace>
    </div>
  );
};
