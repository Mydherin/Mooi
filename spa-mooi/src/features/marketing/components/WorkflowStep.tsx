import type { WorkflowStep as WorkflowStepEntry } from '@/features/marketing/types/WorkflowStep';

interface WorkflowStepProps {
  step: WorkflowStepEntry;
  index: number;
}

export const WorkflowStep = ({ step, index }: WorkflowStepProps) => {
  const Icon = step.icon;

  return (
    <li className="relative">
      <span className="absolute -left-[3.125rem] top-0 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold text-brand lg:static lg:mb-4 lg:flex">
        {index + 1}
      </span>

      <div className="flex items-center gap-2">
        <Icon className="size-4.5 shrink-0 text-brand" />
        <h3 className="text-base font-semibold tracking-tight text-ink">{step.title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.description}</p>
    </li>
  );
};
