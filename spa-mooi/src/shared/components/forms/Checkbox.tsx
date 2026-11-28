import { useId, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  /** Some, not all, of a group are checked. */
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A choice that is confirmed later (a form), with a 44 px tall row as its target. */
export const Checkbox = ({ checked, onChange, label, description, indeterminate = false, disabled = false, className }: CheckboxProps) => {
  const id = useId();
  const Mark = indeterminate ? Minus : Check;

  return (
    <label htmlFor={id} className={cn('flex min-h-11 min-w-0 cursor-pointer items-start gap-3 py-2.5', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="relative mt-px flex size-5 shrink-0">
        <input id={id} type="checkbox" checked={checked} disabled={disabled}
          ref={(node) => { if (node) node.indeterminate = indeterminate; }}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={description ? `${id}-description` : undefined}
          className="peer size-5 cursor-[inherit] appearance-none rounded-[6px] border border-line-strong bg-surface transition-colors checked:border-transparent checked:bg-brand indeterminate:border-transparent indeterminate:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
        <Mark aria-hidden strokeWidth={3}
          className="pointer-events-none absolute inset-0.5 size-4 scale-50 text-white opacity-0 transition duration-150 ease-spring peer-checked:scale-100 peer-checked:opacity-100 peer-indeterminate:scale-100 peer-indeterminate:opacity-100" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-callout text-ink">{label}</span>
        {description ? <span id={`${id}-description`} className="mt-0.5 block text-footnote text-ink-subtle">{description}</span> : null}
      </span>
    </label>
  );
};
