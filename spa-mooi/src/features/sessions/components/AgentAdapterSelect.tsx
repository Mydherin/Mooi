import { useId } from 'react';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import type { AgentAdapter } from '@/features/sessions/types/AgentAdapter';

interface AgentAdapterSelectProps {
  adapters: AgentAdapter[];
  value: string;
  onChange: (id: string) => void;
}

/** How the agent runs, e.g. Claude through its SDK or its CLI: same features, another implementation. */
export const AgentAdapterSelect = ({ adapters, value, onChange }: AgentAdapterSelectProps) => {
  const labelId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-footnote font-semibold text-ink">Adapter</span>
      <SegmentedControl labelledBy={labelId} className="w-full" value={value} onChange={onChange}
        items={adapters.map((adapter) => ({ id: adapter.id, label: adapter.label }))} />
    </div>
  );
};
