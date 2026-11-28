import type { Tone } from '@/shared/types/Tone';
import { cn } from '@/shared/utils/cn';

interface StatusDotProps {
  tone: Tone;
  pulse?: boolean;
  /** Announced to screen readers when the dot stands alone (no visible status text beside it). */
  label?: string;
  className?: string;
}

const fills: Record<Tone, string> = {
  neutral: 'bg-line-strong',
  brand: 'bg-info-dot',
  success: 'bg-success-dot',
  warning: 'bg-warning-dot',
  danger: 'bg-danger-dot',
  info: 'bg-info-dot',
  accent: 'bg-accent-dot',
};

/** A live state radiates a ring (transform + opacity only); a settled one is a plain dot. */
export const StatusDot = ({ tone, pulse = false, label, className }: StatusDotProps) => (
  <span className={cn('relative inline-flex size-2 shrink-0', className)} role={label ? 'img' : undefined} aria-label={label}>
    {pulse ? (
      <span
        aria-hidden
        className={cn('absolute inset-0 rounded-full opacity-70 motion-safe:animate-ping', fills[tone])}
      />
    ) : null}
    <span className={cn('relative size-2 rounded-full', fills[tone])} />
  </span>
);
