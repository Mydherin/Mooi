import type { Factory } from '@/features/factory/types/Factory';
import type { Tone } from '@/shared/types/Tone';

export interface FactoryStatusPresentation {
  label: string;
  tone: Tone;
  /** Agents are working right now. */
  live: boolean;
}

const PAUSED: Record<string, string> = {
  user: 'Paused',
  limits: 'Waiting for limits',
  attention: 'Needs you',
  revoked: 'Sign-in revoked',
  error: 'Stopped on errors',
};

export const factoryStatusPresentation = (factory: Factory): FactoryStatusPresentation => {
  switch (factory.status) {
    case 'defining': return { label: 'Defining', tone: 'info', live: false };
    case 'ready': return { label: 'Ready to start', tone: 'brand', live: false };
    case 'running': return { label: 'Running', tone: 'success', live: true };
    case 'pausing': return { label: 'Pausing', tone: 'warning', live: true };
    case 'resting': return { label: 'Resting', tone: 'neutral', live: false };
    default: return {
      label: PAUSED[factory.pauseReason ?? 'user'] ?? 'Paused',
      tone: factory.pauseReason === 'limits' || factory.pauseReason === 'user' || !factory.pauseReason ? 'neutral' : 'warning',
      live: false,
    };
  }
};
