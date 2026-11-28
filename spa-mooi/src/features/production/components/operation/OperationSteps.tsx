import { Check } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface OperationStep {
  title: string;
  description: string;
}

/** A setup path with the current step highlighted: done steps tick, the active one stands out. */
export const OperationSteps = ({ steps, current }: { steps: OperationStep[]; current: number }) => (
  <ol aria-label="Setup steps" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
    {steps.map((step, index) => {
      const done = index < current;
      const active = index === current;
      return <li key={step.title} aria-current={active ? 'step' : undefined}
        className={cn('flex min-w-0 gap-3 rounded-card border p-3.5 transition-colors duration-200',
          active ? 'border-line-strong bg-surface' : 'border-line bg-surface-2/60')}>
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-bold transition-colors duration-200',
          done ? 'bg-success-soft text-success' : active ? 'bg-contrast text-contrast-ink' : 'bg-surface-3 text-ink-subtle')}>
          {done ? <Check aria-label="Done" className="size-3.5" /> : index + 1}
        </span>
        <span className="min-w-0">
          <span className={cn('block text-callout font-semibold', active || done ? 'text-ink' : 'text-ink-muted')}>{step.title}</span>
          <span className="mt-0.5 block text-footnote text-ink-muted">{step.description}</span>
        </span>
      </li>;
    })}
  </ol>
);
