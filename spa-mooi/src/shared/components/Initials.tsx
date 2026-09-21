import { cn } from '@/shared/utils/cn';

interface InitialsProps {
  value: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'size-7 rounded-md text-[10px]',
  md: 'size-9 rounded-[10px] text-[11px]',
  lg: 'size-12 rounded-xl text-sm',
};

/** The first two letters of the name, which is how Base labels a repository at a glance. */
export const Initials = ({ value, size = 'md', className }: InitialsProps) => (
  <span
    aria-hidden
    className={cn(
      'flex shrink-0 items-center justify-center bg-surface-2 font-extrabold tracking-[0.04em] text-ink-muted uppercase',
      sizes[size],
      className,
    )}
  >
    {value.replace(/[^a-z0-9]/gi, '').slice(0, 2) || '··'}
  </span>
);
