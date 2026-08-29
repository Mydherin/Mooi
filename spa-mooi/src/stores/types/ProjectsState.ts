import type { Project } from '@/features/projects/types/Project';
import type { ProjectsStatus } from '@/features/projects/types/ProjectsStatus';

export interface ProjectsState {
  projects: Project[];
  status: ProjectsStatus;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  upsertProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  setStatus: (status: ProjectsStatus) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}
