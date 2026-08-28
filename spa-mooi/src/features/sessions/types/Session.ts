import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

export interface Session {
  id: string;
  projectId: string;
  title: string;
  status: SessionStatus;
  branch: string;
  provider: string;
  files: number;
  updatedLabel: string;
}
