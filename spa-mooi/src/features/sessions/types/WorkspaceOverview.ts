import type { ProjectWorkspace } from '@/features/sessions/types/ProjectWorkspace';

export interface WorkspaceOverview {
  /** Directory on the sessions pod that holds every session clone. */
  root: string;
  workspaces: ProjectWorkspace[];
  totalBytes: number;
}
