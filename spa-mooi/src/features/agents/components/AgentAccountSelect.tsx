import { accountName } from '@/features/agents/lib/accountName';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import { Select } from '@/shared/components/forms/select/Select';

interface AgentAccountSelectProps {
  connections: AgentConnection[];
  value: string;
  onChange: (id: string) => void;
}

export const AgentAccountSelect = ({ connections, value, onChange }: AgentAccountSelectProps) => (
  <Select label="Agent account" value={value || null} onChange={onChange} placeholder="Select an account"
    options={connections.map((account) => ({ value: account.id, label: accountName(account), description: account.label }))} />
);
