import { Check, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import { cn } from '@/shared/utils/cn';

interface MenuItemRowProps {
  item: MenuItem;
  /** `popover` rows are compact for a pointer; `sheet` rows are tall touch targets. */
  variant: 'popover' | 'sheet';
  onSelect: (item: MenuItem) => void;
}

const roleOf = (item: MenuItem) => (item.selection === 'checkbox' ? 'menuitemcheckbox' : item.selection === 'radio' ? 'menuitemradio' : 'menuitem');

/** One menu row, as a button or a link; both look the same because, in a menu, going and doing are one gesture. */
export const MenuItemRow = ({ item, variant, onSelect }: MenuItemRowProps) => {
  const Icon = item.icon;
  const className = cn(
    'group/item flex w-full min-w-0 items-center gap-3 text-left outline-none transition-colors duration-100',
    variant === 'popover'
      ? 'min-h-10 rounded-chip px-2.5 py-1.5 text-[13.5px] font-medium hover-device:hover:bg-surface-2 focus-visible:bg-surface-2'
      : 'min-h-13 px-4 py-2.5 text-body active:bg-surface-2 focus-visible:bg-surface-2',
    item.destructive ? 'text-danger' : 'text-ink',
    item.disabled && 'pointer-events-none opacity-45',
  );
  const content = (
    <>
      {item.leading ?? (Icon ? <Icon aria-hidden className={cn('size-4.5 shrink-0', item.destructive ? 'text-danger' : 'text-ink-subtle')} /> : null)}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {item.description ? <span className="mt-0.5 block text-footnote font-normal text-ink-subtle line-clamp-2">{item.description}</span> : null}
      </span>
      {item.trailing}
      {item.selection ? <Check aria-hidden className={cn('size-4 shrink-0 text-brand', !item.checked && 'invisible')} /> : null}
      {item.href ? <ExternalLink aria-hidden className="size-3.5 shrink-0 text-ink-subtle" /> : null}
      {item.to && variant === 'sheet' ? <ChevronRight aria-hidden className="size-4 shrink-0 text-line-strong" /> : null}
    </>
  );
  const common = {
    role: roleOf(item),
    'aria-checked': item.selection ? Boolean(item.checked) : undefined,
    'aria-disabled': item.disabled || undefined,
    className,
  };

  if (item.to && !item.disabled) {
    return <Link {...common} to={item.to} state={item.linkState} onClick={() => onSelect(item)}>{content}</Link>;
  }
  if (item.href && !item.disabled) {
    return <a {...common} href={item.href} target="_blank" rel="noreferrer" onClick={() => onSelect(item)}>{content}</a>;
  }
  return <button {...common} type="button" disabled={item.disabled} onClick={() => onSelect(item)}>{content}</button>;
};
