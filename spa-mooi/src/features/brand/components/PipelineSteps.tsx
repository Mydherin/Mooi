import { STAGE_DURATION_MS } from '@/features/brand/lib/pipelineTiming';
import type { PipelineCursor } from '@/features/brand/types/PipelineCursor';
import type { PipelineStage } from '@/features/brand/types/PipelineStage';
import { cn } from '@/shared/utils/cn';

interface PipelineStepsProps {
  steps: PipelineStage[];
  cursor: PipelineCursor;
  onSelect: (stage: number) => void;
}

/** Story-style progress for the numbered steps; once the loop reaches the brand, all read as done. */
export const PipelineSteps = ({ steps, cursor, onSelect }: PipelineStepsProps) => (
  <ol className="relative z-10 grid grid-cols-4 gap-3">
    {steps.map((step, index) => {
      const current = cursor.stage === index;
      const done = cursor.stage > index;
      const Icon = step.icon;

      return (
        <li key={step.id}>
          <button
            type="button"
            onClick={() => onSelect(index)}
            aria-current={current ? 'step' : undefined}
            aria-label={`Show step ${index + 1}: ${step.label}`}
            title={step.label}
            className={cn(
              'flex w-full flex-col gap-2.5 rounded-sm text-left transition-colors duration-300',
              current || done ? 'text-contrast-ink' : 'text-contrast-ink/45 hover:text-contrast-ink/80',
            )}
          >
            <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-contrast-ink/15">
              {current ? (
                <span
                  key={cursor.cycle}
                  style={{ animationDuration: `${STAGE_DURATION_MS}ms` }}
                  className="absolute inset-0 origin-left animate-step-fill rounded-full bg-brand-vivid"
                />
              ) : null}
              {done ? <span className="absolute inset-0 rounded-full bg-contrast-ink/60" /> : null}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Icon className={cn('size-3.5 shrink-0', current && 'text-brand-vivid')} />
              <span className="font-mono text-[10px] opacity-55">0{index + 1}</span>
              <span className="truncate">{step.label}</span>
            </span>
          </button>
        </li>
      );
    })}
  </ol>
);
