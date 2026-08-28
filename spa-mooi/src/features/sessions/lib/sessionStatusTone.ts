import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import type { Tone } from '@/shared/types/Tone';

const tones: Record<SessionStatus, Tone> = {
  working: 'info',
  review: 'warning',
  deployed: 'success',
  failed: 'danger',
  idle: 'neutral',
};

const labels: Record<SessionStatus, string> = {
  working: 'Agent working',
  review: 'In review',
  deployed: 'Deployed',
  failed: 'Failed',
  idle: 'Idle',
};

export const sessionStatusTone = (status: SessionStatus): Tone => tones[status];

export const sessionStatusLabel = (status: SessionStatus): string => labels[status];
