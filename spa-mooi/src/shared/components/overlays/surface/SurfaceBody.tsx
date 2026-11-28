import type { ReactNode, RefObject } from 'react';
import { cn } from '@/shared/utils/cn';

interface SurfaceBodyProps {
  scroller: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  /** No padding, for full-bleed lists. */
  flush?: boolean;
  /** No footer below: the body clears the home indicator itself. */
  last: boolean;
  className?: string;
}

/** The only scroller of a dialog or sheet; its overscroll never reaches the page. */
export const SurfaceBody = ({ scroller, children, flush = false, last, className }: SurfaceBodyProps) => (
  <div ref={scroller} data-scroller
    className={cn('min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain',
      !flush && 'px-5 pt-4 sm:px-6 sm:pt-5', !flush && (last ? 'pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6' : 'pb-5'),
      flush && last && 'pb-(--safe-bottom)', className)}>
    {children}
  </div>
);
