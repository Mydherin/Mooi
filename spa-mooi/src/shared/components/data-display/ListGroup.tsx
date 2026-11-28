import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface ListGroupProps {
  /** Small caps label above the group. */
  title?: string;
  /** Explanatory text under the group. */
  footer?: ReactNode;
  /** Trailing control beside the title (Add, See all). */
  action?: ReactNode;
  children: ReactNode;
  /** `inset` (default): a rounded card with hairline separators. `plain`: separators only, edge to edge. */
  variant?: 'inset' | 'plain';
  className?: string;
}

/** A grouped list of `ListRow`s, the native settings-style pattern for rows of facts or links. */
export const ListGroup = ({ title, footer, action, children, variant = 'inset', className }: ListGroupProps) => (
  <section className={cn('min-w-0', className)}>
    {title || action ? (
      <div className="flex min-h-8 items-end justify-between gap-3 px-1 pb-1.5">
        {title ? <h3 className="truncate text-caption font-semibold tracking-[0.04em] text-ink-subtle uppercase">{title}</h3> : <span />}
        {action}
      </div>
    ) : null}
    <ul role="list" className={cn('min-w-0 divide-y divide-line', variant === 'inset' && 'overflow-hidden rounded-card border border-line bg-surface shadow-card')}>
      {children}
    </ul>
    {footer ? <div className="px-1 pt-1.5 text-footnote text-ink-muted">{footer}</div> : null}
  </section>
);
