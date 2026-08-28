import { AgentStepItem } from '@/features/sessions/components/chat/AgentStepItem';
import type { AgentStep } from '@/features/sessions/types/AgentStep';

interface AgentStepListProps {
  steps: AgentStep[];
}

export const AgentStepList = ({ steps }: AgentStepListProps) => (
  <ul className="mt-3 flex flex-col gap-1.5">
    {steps.map((step) => (
      <AgentStepItem key={step.id} step={step} />
    ))}
  </ul>
);
