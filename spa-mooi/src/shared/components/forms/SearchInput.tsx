import { Search, X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Also the accessible name. */
  placeholder: string;
  autoFocus?: boolean;
  className?: string;
}

/** Search field with a clear button; 16 px text on touch screens, so iOS never zooms into it. */
export const SearchInput = ({ value, onChange, placeholder, autoFocus, className }: SearchInputProps) => (
  <div
    className={cn(
      'flex h-11 w-full min-w-0 items-center gap-2.5 rounded-control border border-line bg-surface pr-1 pl-3 shadow-card transition-[border-color,box-shadow] duration-150 hover-device:hover:border-line-strong focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/12 sm:h-10',
      className,
    )}
  >
    <Search aria-hidden className="size-4 shrink-0 text-ink-subtle" />
    <input
      type="search"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      enterKeyHint="search"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-full w-full min-w-0 bg-transparent text-sm font-medium text-ink placeholder:text-ink-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    {value ? (
      <button type="button" aria-label="Clear search" onClick={() => onChange('')}
        className="flex size-8 shrink-0 items-center justify-center rounded-chip text-ink-subtle transition active:scale-95 hover-device:hover:bg-surface-2 hover-device:hover:text-ink">
        <X aria-hidden className="size-4" />
      </button>
    ) : null}
  </div>
);
