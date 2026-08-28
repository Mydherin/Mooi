import { Search } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export const SearchInput = ({ value, onChange, placeholder, className }: SearchInputProps) => (
  <div
    className={cn(
      'flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 transition focus-within:border-brand/50',
      className,
    )}
  >
    <Search className="size-4 shrink-0 text-ink-subtle" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-full w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
    />
  </div>
);
