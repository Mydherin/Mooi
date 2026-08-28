import type { Tone } from '@/shared/types/Tone';

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-ink-muted',
  brand: 'border-brand/30 bg-brand-soft text-brand',
  success: 'border-success/30 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  danger: 'border-danger/30 bg-danger-soft text-danger',
  info: 'border-info/30 bg-info-soft text-info',
};

export const toneStyles = (tone: Tone): string => tones[tone];
