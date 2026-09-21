import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import type { Tone } from '@/shared/types/Tone';

const tones: Record<SessionStatus, Tone> = {
  provisioning: 'neutral',
  ready: 'success',
  working: 'info',
  waiting: 'warning',
  failed: 'danger',
  closed: 'neutral',
};

const labels: Record<SessionStatus, string> = {
  provisioning: 'Provisioning',
  ready: 'Ready',
  working: 'Agent working',
  waiting: 'Waiting for you',
  failed: 'Failed',
  closed: 'Closed',
};

const pulsing: Record<SessionStatus, boolean> = {
  provisioning: true,
  ready: false,
  working: true,
  waiting: true,
  failed: false,
  closed: false,
};

export const sessionStatusTone = (status: SessionStatus): Tone => tones[status];

export const sessionStatusLabel = (status: SessionStatus): string => labels[status];

export const sessionStatusPulses = (status: SessionStatus): boolean => pulsing[status];
