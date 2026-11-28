import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface PageProps {
  children: ReactNode;
  /** `narrow` forms and settings (42rem), `default` (72rem), `wide` dashboards (90rem), `full` edge to edge. */
  width?: 'narrow' | 'default' | 'wide' | 'full';
  className?: string;
}

const widths = { narrow: 'max-w-2xl', default: 'max-w-6xl', wide: 'max-w-[90rem]', full: 'max-w-none' };

/**
 * The frame of a scrolling screen: put a `PageHeader` first, then `PageSection`s. It sets the
 * gutters (16/24/32 px with safe areas), the max width and the bottom space that clears the tab
 * bar and the home indicator.
 */
export const Page = ({ children, width = 'default', className }: PageProps) => (
  <div className={cn('mx-auto flex w-full min-w-0 flex-col pb-[calc(2rem+var(--safe-bottom))]', widths[width], className)}>
    {children}
  </div>
);
