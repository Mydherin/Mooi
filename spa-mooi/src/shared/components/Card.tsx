import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface CardProps {
  /** Optional so a card can stand in for itself while its content loads. */
  children?: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

export const Card = ({ children, className, as: Tag = 'div' }: CardProps) => (
  <Tag className={cn('min-w-0 rounded-[14px] border border-line bg-surface', className)}>{children}</Tag>
);
