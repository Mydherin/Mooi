import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { matchesOption } from '@/shared/components/forms/select/matchesOption';
import type { SelectAction } from '@/shared/components/forms/select/SelectAction';
import { SelectList } from '@/shared/components/forms/select/SelectList';
import type { SelectOption } from '@/shared/components/forms/select/SelectOption';
import { SearchInput } from '@/shared/components/forms/SearchInput';
import { moveMenuFocus } from '@/shared/components/overlays/menu/moveMenuFocus';
import { Sheet } from '@/shared/components/overlays/sheet/Sheet';
import { AnchoredSurface } from '@/shared/components/overlays/surface/AnchoredSurface';
import { useSheetPickers } from '@/shared/hooks/useSheetPickers';
import { cn } from '@/shared/utils/cn';

interface SelectProps<T extends string> {
  /** Accessible name of the trigger; the sheet's title on phones. */
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  /** A search field above the options; on by default past 8 options. */
  searchable?: boolean;
  actions?: SelectAction[];
  emptyText?: string;
  /** The trigger's content for the selected option; its label and description by default. */
  renderValue?: (option: SelectOption<T>) => ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const SEARCH_FROM = 8;

/**
 * A native-feeling picker: a listbox popover under the trigger on desktop (arrow keys, scrolls
 * inside the room left, never overflows), a bottom sheet with tall rows on phones and touch
 * screens. Long lists get a search field. Use it instead of hand-made dropdowns.
 */
export const Select = <T extends string>({ label, options, value, onChange, placeholder = 'Select…', searchable, actions,
  emptyText = 'Nothing to choose yet.', renderValue, disabled = false, id, className }: SelectProps<T>) => {
  const sheet = useSheetPickers();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const withSearch = searchable ?? options.length > SEARCH_FROM;
  const visible = options.filter((option) => matchesOption(option, query));

  // On desktop the search field, or else the selected option, takes focus (after the surface took it).
  useEffect(() => {
    if (!open || sheet) return;
    const surface = document.getElementById(listId);
    (surface?.querySelector<HTMLElement>('input') ?? surface?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?? surface?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [open, sheet, listId]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (next: string) => {
    close();
    onChange(next as T);
  };
  const act = (action: SelectAction) => {
    close();
    action.onSelect();
  };

  const list = (variant: 'popover' | 'sheet') => (
    <SelectList label={label} options={visible} value={value} variant={variant} emptyText={query ? 'No matches.' : emptyText}
      actions={actions} onSelect={choose} onAction={act} />
  );
  const search = withSearch ? <SearchInput value={query} onChange={setQuery} placeholder={`Search ${label.toLowerCase()}`} /> : null;

  return (
    <>
      <button ref={trigger} id={id} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn('flex min-h-12 w-full min-w-0 items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-left shadow-card transition hover-device:hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/12 disabled:opacity-50 sm:min-h-11',
          open && 'border-brand/60 ring-4 ring-brand/12', className)}>
        {selected && renderValue ? renderValue(selected) : (
          <>
            {selected?.leading ? <span className="flex shrink-0">{selected.leading}</span> : null}
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-sm font-semibold', selected ? 'text-ink' : 'text-ink-subtle')}>{selected?.label ?? placeholder}</span>
              {selected?.description ? <span className="block truncate text-xs text-ink-subtle">{selected.description}</span> : null}
            </span>
          </>
        )}
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-ink-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {sheet ? (
        <Sheet open={open} onClose={close} title={label} flush detents={options.length > 6 ? ['medium', 'large'] : undefined}>
          {search ? <div className="sticky top-0 z-sticky border-b border-line bg-surface px-4 py-3">{search}</div> : null}
          <div id={listId}>{list('sheet')}</div>
        </Sheet>
      ) : (
        <AnchoredSurface open={open} onClose={close} anchor={trigger} placement="bottom-start" matchWidth id={listId} role="dialog" label={label}
          className="w-max min-w-56 max-w-[min(28rem,calc(100vw-1rem))]"
          onKeyDown={(event) => { moveMenuFocus(event); if (event.key === 'Tab') close(); }}>
          {search ? <div className="shrink-0 border-b border-line p-2">{search}</div> : null}
          <div data-scroller className="min-h-0 overflow-y-auto overscroll-contain">{list('popover')}</div>
        </AnchoredSurface>
      )}
    </>
  );
};
