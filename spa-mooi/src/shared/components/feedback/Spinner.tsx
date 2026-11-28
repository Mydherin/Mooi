import { LoaderCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface SpinnerProps {
  /** Announced to screen readers; omit when the surrounding text already says it. */
  label?: string;
  className?: string;
}

/** Indeterminate progress. Inherits the text color; size with `size-*`. */
export const Spinner = ({ label, className }: SpinnerProps) => (
  <>
    <LoaderCircle aria-hidden className={cn('size-4 shrink-0 animate-spin', className)} />
    {label ? <span role="status" className="sr-only">{label}</span> : null}
  </>
);
