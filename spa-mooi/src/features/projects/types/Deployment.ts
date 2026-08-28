import type { DeploymentStatus } from '@/features/projects/types/DeploymentStatus';

export interface Deployment {
  id: string;
  environment: string;
  sha: string;
  message: string;
  status: DeploymentStatus;
  duration: string;
  timeLabel: string;
  author: string;
}
