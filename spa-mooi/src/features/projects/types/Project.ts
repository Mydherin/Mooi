import type { ProjectStatus } from '@/features/projects/types/ProjectStatus';

export interface Project {
  id: string;
  name: string;
  repo: string;
  description: string;
  status: ProjectStatus;
  branch: string;
  sessions: number;
  updatedLabel: string;
  stack: string[];
  productionUrl: string;
}
