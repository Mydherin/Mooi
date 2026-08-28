import { ChevronsUpDown } from 'lucide-react';
import { agentProviders } from '@/features/sessions/data/agentProviders';

interface AgentProviderPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const AgentProviderPicker = ({ value, onChange }: AgentProviderPickerProps) => (
  <span className="relative inline-flex items-center">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Agent provider"
      className="h-8 appearance-none rounded-lg bg-surface-3 pr-7 pl-2.5 text-xs font-medium text-ink-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {agentProviders.map((provider) => (
        <option key={provider.id} value={provider.id}>
          {provider.label}
        </option>
      ))}
    </select>
    <ChevronsUpDown className="pointer-events-none absolute right-2 size-3.5 text-ink-subtle" />
  </span>
);
