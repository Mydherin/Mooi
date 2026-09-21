import type { TabItem } from '@/shared/types/TabItem';
import { cn } from '@/shared/utils/cn';

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

export const Tabs = ({ items, value, onChange, ariaLabel, className }: TabsProps) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={cn('flex min-w-0 items-center gap-5 overflow-x-auto', className)}
  >
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
            'flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-0.5 text-sm font-bold transition',
            isActive ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {Icon ? <Icon className="size-4" /> : null}
          {item.label}
          {typeof item.count === 'number' ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums',
                isActive ? 'bg-contrast text-contrast-ink' : 'bg-surface-2 text-ink-muted',
              )}
            >
              {item.count}
            </span>
          ) : null}
          {item.dot ? <span aria-hidden className="size-1.5 rounded-full bg-success-dot" /> : null}
        </button>
      );
    })}
  </div>
);
