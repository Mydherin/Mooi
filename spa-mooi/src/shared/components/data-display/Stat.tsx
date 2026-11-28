import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/shared/types/Tone';
import { cn } from '@/shared/utils/cn';

interface StatProps {
  label: string;
  /** The figure; pass `<CompactNumber>` for counts that can grow large. */
  value: ReactNode;
  /** Context under the value ("of 12", "+3 today"). */
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

const inks: Partial<Record<Tone, string>> = {
  success: 'text-success', warning: 'text-warning', danger: 'text-danger', brand: 'text-brand', info: 'text-info', accent: 'text-accent',
};

/** One KPI: a label, a large tabular figure and optional context. Lay several out in a grid; values never wrap. */
export const Stat = ({ label, value, hint, icon: Icon, tone = 'neutral', className }: StatProps) => (
  <div className={cn('min-w-0 rounded-card border border-line bg-surface px-4 py-3.5 shadow-card', className)}>
    <p className="flex min-w-0 items-center gap-1.5 text-caption font-medium text-ink-subtle">
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{label}</span>
    </p>
    <p className={cn('mt-1 truncate text-title tabular-nums', inks[tone] ?? 'text-ink')}>{value}</p>
    {hint ? <p className="mt-0.5 truncate text-caption text-ink-muted">{hint}</p> : null}
  </div>
);
