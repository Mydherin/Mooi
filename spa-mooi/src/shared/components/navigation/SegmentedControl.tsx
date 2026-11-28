import type { KeyboardEvent } from 'react';
import type { SegmentItem } from '@/shared/types/SegmentItem';
import { cn } from '@/shared/utils/cn';

interface SegmentedControlProps {
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Id of the element naming the group. */
  labelledBy?: string;
  /** Names the group when no visible label exists. */
  ariaLabel?: string;
}

/** Two to five mutually exclusive options of one view or setting; arrow keys move the choice. */
export const SegmentedControl = ({ items, value, onChange, className, labelledBy, ariaLabel }: SegmentedControlProps) => {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    const next = step ? items[(index + step + items.length) % items.length] : undefined;
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    requestAnimationFrame(() => (event.target as HTMLElement).parentElement?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={ariaLabel} onKeyDown={onKeyDown}
      className={cn('inline-flex flex-wrap gap-1 rounded-control border border-line bg-surface-2 p-0.5', className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-[background-color,color,box-shadow,transform] duration-200 ease-standard active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              isActive ? 'bg-surface text-ink shadow-raised ring-1 ring-line' : 'text-ink-muted hover-device:hover:text-ink',
            )}
          >
            {Icon ? <Icon aria-hidden className="size-4" /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
