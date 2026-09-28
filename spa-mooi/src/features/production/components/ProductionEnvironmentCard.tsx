import { KeyRound, Settings2 } from 'lucide-react';
import type { ProductionEnvironmentVariable } from '@/features/production/types/ProductionEnvironmentVariable';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { StatusDot } from '@/shared/components/StatusDot';

interface ProductionEnvironmentCardProps {
  variables: ProductionEnvironmentVariable[];
  onEdit: () => void;
}

/** Which variables the scripts read and whether each one has a value; values themselves never show. */
export const ProductionEnvironmentCard = ({ variables, onEdit }: ProductionEnvironmentCardProps) => {
  const missing = variables.filter((variable) => variable.required && !variable.configured).length;

  return (
    <Card as="section" className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink"><KeyRound className="size-4 text-ink-subtle" />Environment</h2>
          <p className="mt-0.5 text-xs text-ink-muted">{missing > 0 ? `${missing} required value${missing === 1 ? '' : 's'} missing` : 'Encrypted in the platform, write-only'}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit}><Settings2 className="size-4" />Manage</Button>
      </header>
      {variables.length === 0 ? <p className="px-5 py-6 text-sm text-ink-muted">No variables yet. The agent asks for them while it prepares the scripts.</p>
        : <ul className="flex flex-wrap gap-2 p-5">
          {variables.map((variable) => <li key={variable.name}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-2 py-1.5 pr-3 pl-2.5"
            title={variable.configured ? 'Set' : variable.required ? 'Missing' : 'Optional, not set'}>
            <StatusDot tone={variable.configured ? 'success' : variable.required ? 'danger' : 'neutral'} />
            <span className="truncate font-mono text-[11px] font-bold text-ink">{variable.name.replace(/^MOOI_PRODUCTION_/, '')}</span>
          </li>)}
        </ul>}
    </Card>
  );
};
