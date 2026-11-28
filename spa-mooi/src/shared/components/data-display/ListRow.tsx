import { useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import { useDrag } from '@/shared/gestures/useDrag';
import { cn } from '@/shared/utils/cn';

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Value or control at the end (a badge, a switch, a count). */
  trailing?: ReactNode;
  /** Shows a chevron: the row leads somewhere. On by default for `to`. */
  chevron?: boolean;
  to?: string;
  linkState?: unknown;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Actions revealed by swiping the row left on touch screens. Always offer them elsewhere too (a menu). */
  swipeActions?: Pick<MenuItem, 'id' | 'label' | 'icon' | 'destructive' | 'onSelect'>[];
  className?: string;
}

const ACTION_WIDTH = 76;

/** One row of a `ListGroup`: leading, a title over a subtitle, trailing, and a chevron when it navigates. */
export const ListRow = ({ title, subtitle, leading, trailing, chevron, to, linkState, onClick, disabled = false, destructive = false,
  swipeActions, className }: ListRowProps) => {
  const content = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const actionsWidth = (swipeActions?.length ?? 0) * ACTION_WIDTH;
  const settle = (open: boolean) => {
    const element = content.current;
    if (!element) return;
    element.style.transition = 'translate var(--duration-base) var(--ease-out-expo)';
    element.style.translate = open ? `${-actionsWidth}px 0` : '';
    setRevealed(open);
  };
  const swipe = useDrag({
    axis: 'x',
    enabled: actionsWidth > 0,
    filter: (event) => event.pointerType !== 'mouse',
    onStart: () => { if (content.current) content.current.style.transition = 'none'; },
    onMove: ({ dx }) => {
      const base = revealed ? -actionsWidth : 0;
      const offset = Math.min(0, Math.max(-actionsWidth * 1.2, base + dx));
      if (content.current) content.current.style.translate = `${offset}px 0`;
    },
    onEnd: ({ dx, vx }) => settle(revealed ? dx < actionsWidth / 2 && vx < 0.3 : dx < -actionsWidth / 2 || vx < -0.3),
    onCancel: () => settle(revealed),
  });

  const body = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-body font-medium', destructive ? 'text-danger' : 'text-ink')}>{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-footnote text-ink-subtle">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2 text-callout text-ink-muted">{trailing}</span> : null}
      {chevron ?? Boolean(to) ? <ChevronRight aria-hidden className="size-4 shrink-0 text-line-strong" /> : null}
    </>
  );
  const rowClass = cn('flex min-h-13 w-full min-w-0 items-center gap-3 bg-surface px-4 py-2.5 text-left transition-colors duration-100 outline-none',
    (to || onClick) && !disabled && 'active:bg-surface-2 hover-device:hover:bg-surface-2/60 focus-visible:bg-surface-2',
    disabled && 'pointer-events-none opacity-50');

  return (
    <li className={cn('relative min-w-0 overflow-hidden', className)}>
      {swipeActions?.length ? (
        <div aria-hidden={!revealed} className="absolute inset-y-0 right-0 flex">
          {swipeActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id} type="button" tabIndex={revealed ? 0 : -1} onClick={() => { settle(false); action.onSelect?.(); }}
                style={{ width: ACTION_WIDTH }}
                className={cn('flex h-full flex-col items-center justify-center gap-1 text-caption font-semibold text-white', action.destructive ? 'bg-danger-dot' : 'bg-info-dot')}>
                {Icon ? <Icon aria-hidden className="size-4.5" /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div ref={content} onPointerDown={swipe.onPointerDown} className={cn('relative', actionsWidth > 0 && 'touch-pan-y')}>
        {to && !disabled ? <Link to={to} state={linkState} className={rowClass}>{body}</Link>
          : onClick ? <button type="button" onClick={onClick} disabled={disabled} className={rowClass}>{body}</button>
            : <div className={rowClass}>{body}</div>}
      </div>
    </li>
  );
};
