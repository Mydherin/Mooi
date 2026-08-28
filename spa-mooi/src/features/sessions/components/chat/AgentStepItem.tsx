import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { agentStepIcon } from '@/features/sessions/lib/agentStepIcon';
import type { AgentStep } from '@/features/sessions/types/AgentStep';

interface AgentStepItemProps {
  step: AgentStep;
}

export const AgentStepItem = ({ step }: AgentStepItemProps) => {
  const Icon = agentStepIcon(step.kind);

  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2">
      <Icon className="size-3.5 shrink-0 text-ink-subtle" />

      <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
        {step.target}
      </span>

      {step.added !== undefined ? (
        <span className="shrink-0 font-mono text-xs text-success">+{step.added}</span>
      ) : null}
      {step.removed !== undefined ? (
        <span className="shrink-0 font-mono text-xs text-danger">−{step.removed}</span>
      ) : null}
      {step.meta ? <span className="shrink-0 text-xs text-ink-subtle">{step.meta}</span> : null}

      {step.status === 'done' ? <Check className="size-3.5 shrink-0 text-success" /> : null}
      {step.status === 'running' ? (
        <LoaderCircle className="size-3.5 shrink-0 animate-spin text-info" />
      ) : null}
      {step.status === 'failed' ? (
        <CircleAlert className="size-3.5 shrink-0 text-danger" />
      ) : null}
    </li>
  );
};
