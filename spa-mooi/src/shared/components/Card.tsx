import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface CardProps {
  /** Optional so a card can stand in for itself while its content loads. */
  children?: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

export const Card = ({ children, className, as: Tag = 'div' }: CardProps) => (
  <Tag className={cn('rounded-2xl border border-line bg-surface', className)}>{children}</Tag>
);
