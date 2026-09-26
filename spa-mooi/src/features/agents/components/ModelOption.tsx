import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface ModelOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: ReactNode;
  tag?: ReactNode;
  tone?: 'default' | 'warning';
  disabled?: boolean;
}

/** One selectable model tile; a real radio underneath, so arrow keys move through the group. */
export const ModelOption = ({ name, value, checked, onSelect, title, hint, tag, tone = 'default', disabled }: ModelOptionProps) => (
  <label className={cn('relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border bg-surface p-3.5 transition duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-disabled:cursor-not-allowed has-disabled:opacity-50',
    tone === 'warning' ? 'border-warning-dot bg-warning-soft ring-1 ring-warning-dot'
      : checked ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong hover:bg-surface-2/60')}>
    <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onSelect} className="sr-only" />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-bold text-ink">{title}</span>
        {tag}
      </span>
      <span className="mt-0.5 block truncate text-xs text-ink-subtle">{hint}</span>
    </span>
    <span aria-hidden className={cn('mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 transition',
      checked ? 'border-ink' : 'border-line-strong')}>
      <span className={cn('size-2 rounded-full bg-ink transition', checked ? 'scale-100' : 'scale-0')} />
    </span>
  </label>
);
