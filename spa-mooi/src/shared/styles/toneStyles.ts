import type { Tone } from '@/shared/types/Tone';

const tones: Record<Tone, string> = {
  neutral: 'border-transparent bg-surface-2 text-ink-muted',
  brand: 'border-transparent bg-brand-soft text-brand-strong',
  success: 'border-transparent bg-success-soft text-success',
  warning: 'border-transparent bg-warning-soft text-warning',
  danger: 'border-transparent bg-danger-soft text-danger',
  info: 'border-transparent bg-info-soft text-info',
  accent: 'border-transparent bg-accent-soft text-accent',
};

export const toneStyles = (tone: Tone): string => tones[tone];
