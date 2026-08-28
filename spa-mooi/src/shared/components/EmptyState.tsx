import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, children }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
    <span className="flex size-12 items-center justify-center rounded-xl bg-surface-2 text-ink-subtle">
      <Icon className="size-5" />
    </span>
    <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">{title}</h3>
    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
    {children ? <div className="mt-6">{children}</div> : null}
  </div>
);
