import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Actions that resolve the emptiness (Add, Create). */
  children?: ReactNode;
  /** Without the dashed card, for use inside an existing surface. */
  bare?: boolean;
  className?: string;
}

/** Nothing here yet: what this place is for, and the way to fill it. */
export const EmptyState = ({ icon: Icon, title, description, children, bare = false, className }: EmptyStateProps) => (
  <div className={cn('relative flex animate-fade-up flex-col items-center justify-center overflow-hidden px-6 py-12 text-center sm:py-16',
    !bare && 'rounded-card border border-dashed border-line-strong bg-surface', className)}>
    {bare ? null : <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />}
    <span className="relative flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted shadow-raised">
      <Icon aria-hidden className="size-5" />
    </span>
    <h3 className="relative mt-5 text-headline text-ink">{title}</h3>
    <p className="relative mt-1.5 max-w-sm text-callout text-ink-muted">{description}</p>
    {children ? <div className="relative mt-6 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">{children}</div> : null}
  </div>
);
