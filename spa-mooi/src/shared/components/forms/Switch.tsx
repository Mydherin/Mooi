import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  /** Visually hides the label (it still names the switch), for switches inside a labelled row. */
  hideLabel?: boolean;
  className?: string;
}

/** An on/off setting that applies at once. The whole row is the target; the thumb springs across. */
export const Switch = ({ checked, onChange, label, description, disabled = false, hideLabel = false, className }: SwitchProps) => {
  const id = useId();

  return (
    <label htmlFor={id} className={cn('flex min-h-11 min-w-0 cursor-pointer items-center gap-3', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className={cn('min-w-0 flex-1', hideLabel && 'sr-only')}>
        <span className="block text-callout font-medium text-ink">{label}</span>
        {description ? <span id={`${id}-description`} className="mt-0.5 block text-footnote text-ink-subtle">{description}</span> : null}
      </span>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled}
        aria-describedby={description ? `${id}-description` : undefined}
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          checked ? 'bg-success-dot' : 'bg-surface-3')}>
        <span aria-hidden className={cn('size-6 rounded-full bg-white shadow-raised transition-transform duration-300 ease-spring', checked && 'translate-x-5')} />
      </button>
    </label>
  );
};
