import { Settings2 } from 'lucide-react';
import { inheritedEnvironment } from '@/features/platform/lib/inheritedEnvironment';
import { shortVariableName } from '@/features/platform/lib/environmentNames';
import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';
import { Button } from '@/shared/components/actions/Button';
import { Card } from '@/shared/components/data-display/Card';
import { StatusDot } from '@/shared/components/data-display/StatusDot';

interface PlatformEnvironmentCardProps {
  variables: PlatformEnvironmentVariable[];
  emptyDescription: string;
  onEdit: () => void;
}

const stateLabel = (variable: PlatformEnvironmentVariable): string =>
  variable.configured ? 'set' : variable.required ? 'missing' : 'optional, not set';

/** Which variables the scripts read and whether each one has a value; values themselves never show. */
export const PlatformEnvironmentCard = ({ variables, emptyDescription, onEdit }: PlatformEnvironmentCardProps) => {
  const missing = variables.filter((variable) => variable.required && !variable.configured).length;

  return (
    <Card as="section" className="flex flex-col">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-headline text-ink">Environment</h2>
          <p className={missing > 0 ? 'text-footnote text-danger' : 'text-footnote text-ink-muted'}>
            {missing > 0 ? `${missing} required value${missing === 1 ? '' : 's'} missing` : 'Encrypted in the platform'}</p>
        </div>
        <Button variant="secondary" size="sm" icon={Settings2} onClick={onEdit}>Manage</Button>
      </header>
      {variables.length === 0 ? <p className="px-4 py-5 text-callout text-ink-muted sm:px-5">{emptyDescription}</p>
        : <ul className="flex min-w-0 flex-wrap gap-2 p-4 sm:p-5">
          {variables.map((variable) => <li key={variable.name} aria-label={`${variable.name}: ${stateLabel(variable)}${variable.inherited ? ', inherited' : ''}`}
            className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 py-1.5 pr-3 pl-2.5">
            <StatusDot tone={variable.configured ? 'success' : variable.required ? 'danger' : 'neutral'} />
            <span className="truncate font-mono text-caption font-semibold text-ink">{shortVariableName(variable.name)}</span>
            {variable.inherited ? <span className="text-caption font-semibold text-ink-subtle uppercase">{inheritedEnvironment(variable.name).tag}</span> : null}
          </li>)}
        </ul>}
    </Card>
  );
};
