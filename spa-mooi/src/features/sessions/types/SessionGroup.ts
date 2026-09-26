import type { Session } from '@/features/sessions/types/Session';

/** The sessions of one project, as the overview lists them. */
export interface SessionGroup {
  projectId: string;
  projectName: string;
  sessions: Session[];
}
