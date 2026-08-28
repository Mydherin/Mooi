import type { ProjectFilterId } from '@/features/projects/types/ProjectFilterId';

interface ProjectFilter {
  id: ProjectFilterId;
  label: string;
}

export const projectFilters: ProjectFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'building', label: 'Building' },
  { id: 'idle', label: 'Idle' },
  { id: 'archived', label: 'Archived' },
];
