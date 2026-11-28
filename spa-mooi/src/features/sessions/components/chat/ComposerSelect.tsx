import { Select } from '@/shared/components/forms/select/Select';
import type { SelectOption } from '@/shared/components/forms/select/SelectOption';
import { keepCurrentOption } from '@/features/sessions/lib/keepCurrentOption';

interface ComposerSelectProps {
  value: string;
  /** Options shown; the current value is kept as an extra one when it is not among them. */
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled: boolean;
  label: string;
  /** Visible caption beside the picker from `sm`; phones rely on the value alone. */
  caption?: string;
}

/** A compact chip picker for the composer toolbar, on the shared `Select` (popover on desktop, sheet on touch). */
export const ComposerSelect = ({ value, options, onChange, disabled, label, caption }: ComposerSelectProps) => (
  <span className="flex shrink-0 items-center gap-1.5 text-caption text-ink-subtle">
    {caption ? <span aria-hidden className="hidden sm:inline">{caption}</span> : null}
    <Select label={label} value={value || null} options={keepCurrentOption(options, value)} onChange={onChange} disabled={disabled}
      renderValue={(option) => <span className="min-w-0 flex-1 truncate">{option.label}</span>}
      className="min-h-9 max-w-[7.5rem] gap-1 rounded-chip px-2.5 py-1 text-caption font-medium text-ink sm:min-h-9 sm:max-w-[9rem]" />
  </span>
);
