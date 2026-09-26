import { Gauge } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface EffortPickerProps {
  name: string;
  efforts: string[];
  modelDefault: string | null;
  value: string;
  onChange: (effort: string) => void;
  disabled: boolean;
}

const pill = 'inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-[13px] font-bold capitalize transition duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-disabled:cursor-not-allowed has-disabled:opacity-50';

/** Reasoning effort as a row of pills, limited to the levels the selected model supports. */
export const EffortPicker = ({ name, efforts, modelDefault, value, onChange, disabled }: EffortPickerProps) => {
  const options = ['', ...efforts, ...(value && !efforts.includes(value) ? [value] : [])];

  return <fieldset className="min-w-0" disabled={disabled}>
    <legend className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
      <Gauge className="size-3.5" /> Reasoning effort
    </legend>
    {efforts.length === 0 && !value
      ? <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-ink-subtle">This model has no configurable effort levels.</p>
      : <div className="flex flex-wrap gap-2">
        {options.map((effort) => {
          const checked = effort === value;
          const unavailable = effort !== '' && !efforts.includes(effort);
          return <label key={effort || 'default'} className={cn(pill,
            unavailable ? 'border-warning-dot bg-warning-soft text-warning line-through'
              : checked ? 'border-contrast bg-contrast text-contrast-ink' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink')}>
            <input type="radio" name={name} value={effort} checked={checked} onChange={() => onChange(effort)} className="sr-only" />
            {effort || `Auto${modelDefault ? ` · ${modelDefault}` : ''}`}
          </label>;
        })}
      </div>}
  </fieldset>;
};
