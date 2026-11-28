import type { SelectAction } from '@/shared/components/forms/select/SelectAction';
import type { SelectOption } from '@/shared/components/forms/select/SelectOption';
import { SelectOptionRow } from '@/shared/components/forms/select/SelectOptionRow';
import { cn } from '@/shared/utils/cn';

interface SelectListProps {
  label: string;
  options: SelectOption[];
  value: string | null;
  variant: 'popover' | 'sheet';
  emptyText: string;
  actions?: SelectAction[];
  onSelect: (value: string) => void;
  onAction: (action: SelectAction) => void;
}

/** The options and the trailing actions, shared by the desktop popover and the phone sheet. */
export const SelectList = ({ label, options, value, variant, emptyText, actions, onSelect, onAction }: SelectListProps) => (
  <>
    <div role="listbox" aria-label={label} className={cn(variant === 'popover' ? 'p-1' : 'divide-y divide-line')}>
      {options.length === 0 ? <p className="px-4 py-3 text-callout text-ink-muted">{emptyText}</p> : null}
      {options.map((option) => (
        <SelectOptionRow key={option.value} option={option} selected={option.value === value} variant={variant} onSelect={() => onSelect(option.value)} />
      ))}
    </div>
    {actions?.length ? (
      <div className={cn('border-t border-line', variant === 'popover' ? 'p-1' : 'divide-y divide-line')}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.id} type="button" onClick={() => onAction(action)}
              className={cn('flex w-full items-center gap-3 text-left font-semibold text-ink outline-none transition-colors',
                variant === 'popover' ? 'min-h-10 rounded-chip px-2.5 text-sm hover-device:hover:bg-surface-2 focus-visible:bg-surface-2'
                  : 'min-h-13 px-4 text-body active:bg-surface-2')}>
              <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" />{action.label}
            </button>
          );
        })}
      </div>
    ) : null}
  </>
);
