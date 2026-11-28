import type { ReactNode } from 'react';

interface SurfaceFooterProps {
  children: ReactNode;
}

/**
 * Sticky actions under the body. On phones they stack full width with the last one (the primary,
 * by convention) at the bottom, in thumb reach; from `sm` they sit in a row at the end.
 * Pass actions as `Cancel, …, Primary`; `sm:mr-auto` on one pushes it to the start on desktop.
 */
export const SurfaceFooter = ({ children }: SurfaceFooterProps) => (
  <footer className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] *:w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-6 sm:py-3.5 sm:*:w-auto">
    {children}
  </footer>
);
