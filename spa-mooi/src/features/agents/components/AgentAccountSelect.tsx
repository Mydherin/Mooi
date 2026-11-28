import { accountName } from '@/features/agents/lib/accountName';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import { SelectField } from '@/shared/components/forms/select/SelectField';

interface AgentAccountSelectProps {
  connections: AgentConnection[];
  value: string;
  onChange: (id: string) => void;
}

/** The provider account a session runs with: its title, with the provider underneath. */
export const AgentAccountSelect = ({ connections, value, onChange }: AgentAccountSelectProps) => (
  <SelectField label="Agent account" value={value || null} onChange={onChange} placeholder="Select an account"
    options={connections.map((account) => ({ value: account.id, label: accountName(account), description: account.label }))} />
);
