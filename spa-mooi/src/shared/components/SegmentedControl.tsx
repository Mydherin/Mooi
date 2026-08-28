import type { SegmentItem } from '@/shared/types/SegmentItem';
import { cn } from '@/shared/utils/cn';

interface SegmentedControlProps {
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export const SegmentedControl = ({ items, value, onChange, className }: SegmentedControlProps) => (
  <div role="tablist" className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}>
    {items.map((item) => {
      const Icon = item.icon;
      const isActive = item.id === value;

      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(item.id)}
          className={cn(
            'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          {Icon ? <Icon className="size-4" /> : null}
          {item.label}
        </button>
      );
    })}
  </div>
);
