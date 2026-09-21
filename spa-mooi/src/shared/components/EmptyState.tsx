import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, children }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center sm:py-16">
    <span className="flex size-11 items-center justify-center rounded-[10px] bg-surface-2 text-ink-subtle">
      <Icon className="size-5" />
    </span>
    <h3 className="mt-5 text-base font-extrabold tracking-[-0.02em] text-ink">{title}</h3>
    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
    {children ? <div className="mt-6">{children}</div> : null}
  </div>
);
