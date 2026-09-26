import type { Project } from '@/features/projects/types/Project';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionGroup } from '@/features/sessions/types/SessionGroup';

/** Groups keep the order of their newest session, so the project touched last comes first. */
export const groupSessionsByProject = (sessions: Session[], projects: Project[]): SessionGroup[] => {
  const groups = new Map<string, SessionGroup>();

  sessions.forEach((session) => {
    const group = groups.get(session.projectId);

    if (group) {
      group.sessions.push(session);
      return;
    }

    const project = projects.find((candidate) => candidate.id === session.projectId);
    groups.set(session.projectId, {
      projectId: session.projectId,
      projectName: project?.name ?? session.projectFullName,
      sessions: [session],
    });
  });

  return [...groups.values()];
};
