import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export const Eyebrow = ({ children, className }: EyebrowProps) => (
  <p className={cn('text-[11px] font-extrabold tracking-[0.09em] text-ink-subtle uppercase', className)}>
    {children}
  </p>
);
