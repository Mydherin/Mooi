import { cn } from '@/shared/utils/cn';

interface SkeletonProps {
  /** Size and shape with utilities (`h-4 w-32`, `size-9 rounded-full`). */
  className?: string;
  /** Renders that many text lines, the last one shorter. */
  lines?: number;
}

/** A placeholder in the shape of what is loading, so the layout never jumps when it arrives. */
export const Skeleton = ({ className, lines }: SkeletonProps) => {
  if (lines && lines > 1) {
    return (
      <span aria-hidden className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className={cn('h-3.5 animate-pulse-soft rounded-full bg-surface-3', index === lines - 1 ? 'w-3/5' : 'w-full')} />
        ))}
      </span>
    );
  }
  return <span aria-hidden className={cn('block h-4 animate-pulse-soft rounded-chip bg-surface-3', className)} />;
};
