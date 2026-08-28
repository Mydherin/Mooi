import { projects } from '@/features/projects/data/projects';
import type { Project } from '@/features/projects/types/Project';

export const findProject = (projectId: string | undefined): Project | undefined =>
  projects.find((project) => project.id === projectId);
