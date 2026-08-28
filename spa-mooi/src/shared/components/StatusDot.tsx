import type { Tone } from '@/shared/types/Tone';
import { cn } from '@/shared/utils/cn';

interface StatusDotProps {
  tone: Tone;
  pulse?: boolean;
}

const fills: Record<Tone, string> = {
  neutral: 'bg-ink-subtle',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export const StatusDot = ({ tone, pulse = false }: StatusDotProps) => (
  <span className="relative inline-flex size-2 shrink-0">
    {pulse ? (
      <span
        aria-hidden
        className={cn('absolute inset-0 animate-pulse-soft rounded-full blur-[3px]', fills[tone])}
      />
    ) : null}
    <span className={cn('relative size-2 rounded-full', fills[tone])} />
  </span>
);
