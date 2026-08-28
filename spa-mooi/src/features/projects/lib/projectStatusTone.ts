import type { ProjectStatus } from '@/features/projects/types/ProjectStatus';
import type { Tone } from '@/shared/types/Tone';

const tones: Record<ProjectStatus, Tone> = {
  live: 'success',
  building: 'warning',
  idle: 'neutral',
  failed: 'danger',
  archived: 'neutral',
};

const labels: Record<ProjectStatus, string> = {
  live: 'Live',
  building: 'Building',
  idle: 'Idle',
  failed: 'Failed',
  archived: 'Archived',
};

export const projectStatusTone = (status: ProjectStatus): Tone => tones[status];

export const projectStatusLabel = (status: ProjectStatus): string => labels[status];
