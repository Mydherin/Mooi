import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface PageSectionProps {
  title?: string;
  description?: ReactNode;
  /** Controls on the title row (a filter, "See all"); collapse several with `ResponsiveActions`. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block of a page, with the page gutters and the vertical rhythm between blocks. */
export const PageSection = ({ title, description, actions, children, className }: PageSectionProps) => {
  const id = useId();

  return (
    <section aria-labelledby={title ? id : undefined} className={cn('min-w-0 px-gutter pt-6 first:pt-4 sm:pt-8', className)}>
      {title || actions ? (
        <div className="mb-3 flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 id={id} className="truncate text-headline text-ink">{title}</h2> : null}
            {description ? <div className="mt-0.5 text-footnote text-ink-muted">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
};
