import type { Project } from '@/features/projects/types/Project';

export const findProject = (
  projects: Project[],
  projectId: string | undefined,
): Project | undefined => projects.find((project) => project.id === projectId);
