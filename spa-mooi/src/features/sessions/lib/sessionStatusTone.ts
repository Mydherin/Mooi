import type { SessionDisplayStatus } from '@/features/sessions/types/SessionDisplayStatus';
import type { Tone } from '@/shared/types/Tone';

const tones: Record<SessionDisplayStatus, Tone> = {
  provisioning: 'neutral',
  ready: 'success',
  working: 'info',
  waiting: 'warning',
  deploying: 'accent',
  deployed: 'accent',
  failed: 'danger',
  closed: 'neutral',
};

const labels: Record<SessionDisplayStatus, string> = {
  provisioning: 'Provisioning',
  ready: 'Ready',
  working: 'Working',
  waiting: 'Waiting for you',
  deploying: 'Deploying',
  deployed: 'Deployed',
  failed: 'Failed',
  closed: 'Closed',
};

const pulsing: Record<SessionDisplayStatus, boolean> = {
  provisioning: true,
  ready: false,
  working: true,
  waiting: true,
  deploying: true,
  deployed: false,
  failed: false,
  closed: false,
};

export const sessionStatusTone = (status: SessionDisplayStatus): Tone => tones[status];

export const sessionStatusLabel = (status: SessionDisplayStatus): string => labels[status];

export const sessionStatusPulses = (status: SessionDisplayStatus): boolean => pulsing[status];
