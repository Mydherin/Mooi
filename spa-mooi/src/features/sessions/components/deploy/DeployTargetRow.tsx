import { Check } from 'lucide-react';
import type { DeployTarget } from '@/features/sessions/types/DeployTarget';
import { cn } from '@/shared/utils/cn';

interface DeployTargetRowProps {
  target: DeployTarget;
  selected: boolean;
  onSelect: (id: string) => void;
}

export const DeployTargetRow = ({ target, selected, onSelect }: DeployTargetRowProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={() => onSelect(target.id)}
    className={cn(
      'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      selected ? 'border-brand/40 bg-brand-soft' : 'border-line bg-surface hover:border-line-strong',
    )}
  >
    <span
      className={cn(
        'flex size-4.5 shrink-0 items-center justify-center rounded-full border',
        selected ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong',
      )}
    >
      {selected ? <Check className="size-3" /> : null}
    </span>

    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-ink">{target.name}</span>
      <span className="mt-0.5 block truncate font-mono text-xs text-ink-subtle">{target.url}</span>
      <span className="mt-0.5 block truncate text-xs text-ink-subtle">
        {target.branch} · {target.lastDeployLabel}
      </span>
    </span>
  </button>
);
