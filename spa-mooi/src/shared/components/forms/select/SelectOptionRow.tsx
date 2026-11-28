import { Check } from 'lucide-react';
import type { SelectOption } from '@/shared/components/forms/select/SelectOption';
import { cn } from '@/shared/utils/cn';

interface SelectOptionRowProps {
  option: SelectOption;
  selected: boolean;
  variant: 'popover' | 'sheet';
  onSelect: () => void;
}

export const SelectOptionRow = ({ option, selected, variant, onSelect }: SelectOptionRowProps) => (
  <button type="button" role="option" aria-selected={selected} aria-disabled={option.disabled || undefined} disabled={option.disabled}
    onClick={onSelect}
    className={cn('flex w-full min-w-0 items-center gap-3 text-left outline-none transition-colors duration-100 disabled:opacity-45',
      variant === 'popover' ? 'min-h-10 rounded-chip px-2.5 py-2 hover-device:hover:bg-surface-2 focus-visible:bg-surface-2'
        : 'min-h-13 px-4 py-2.5 active:bg-surface-2 focus-visible:bg-surface-2')}>
    {option.leading ? <span className="flex shrink-0">{option.leading}</span> : null}
    <span className="min-w-0 flex-1">
      <span className={cn('block truncate font-semibold text-ink', variant === 'popover' ? 'text-sm' : 'text-body')}>{option.label}</span>
      {option.description ? <span className="block truncate text-footnote text-ink-subtle">{option.description}</span> : null}
    </span>
    <Check aria-hidden className={cn('size-4 shrink-0 text-brand', !selected && 'invisible')} />
  </button>
);
