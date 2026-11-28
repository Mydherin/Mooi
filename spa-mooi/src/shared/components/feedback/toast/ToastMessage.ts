import type { Tone } from '@/shared/types/Tone';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: Extract<Tone, 'neutral' | 'success' | 'warning' | 'danger'>;
  action?: ToastAction;
  /** How long it stays, in ms; errors stay until dismissed when 0. */
  duration?: number;
}
