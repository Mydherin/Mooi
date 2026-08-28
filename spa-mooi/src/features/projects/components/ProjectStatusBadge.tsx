import { projectStatusLabel, projectStatusTone } from '@/features/projects/lib/projectStatusTone';
import type { ProjectStatus } from '@/features/projects/types/ProjectStatus';
import { Badge } from '@/shared/components/Badge';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

export const ProjectStatusBadge = ({ status }: ProjectStatusBadgeProps) => (
  <Badge tone={projectStatusTone(status)}>{projectStatusLabel(status)}</Badge>
);
