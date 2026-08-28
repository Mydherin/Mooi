import { sessions } from '@/features/sessions/data/sessions';
import type { Session } from '@/features/sessions/types/Session';

export const findSession = (
  projectId: string | undefined,
  sessionId: string | undefined,
): Session | undefined => {
  const projectSessions = sessions.filter((session) => session.projectId === projectId);

  return projectSessions.find((session) => session.id === sessionId) ?? projectSessions[0];
};
