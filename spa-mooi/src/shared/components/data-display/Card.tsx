import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface CardProps {
  /** Optional so a card can stand in for itself while its content loads. */
  children?: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

/** A raised surface grouping related content. Pad it with `p-4 sm:p-5`; it never clips its children's focus rings. */
export const Card = ({ children, className, as: Tag = 'div' }: CardProps) => (
  <Tag className={cn('min-w-0 rounded-card border border-line bg-surface shadow-card', className)}>{children}</Tag>
);
