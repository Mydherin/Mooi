import type { ProjectStatus } from '@/features/projects/types/ProjectStatus';

export interface EnvironmentSummary {
  id: string;
  name: string;
  url: string;
  branch: string;
  status: ProjectStatus;
  lastDeployLabel: string;
}
