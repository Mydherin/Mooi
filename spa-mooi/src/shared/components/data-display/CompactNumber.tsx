import { formatCount } from '@/shared/utils/formatCount';
import { cn } from '@/shared/utils/cn';

interface CompactNumberProps {
  value: number;
  className?: string;
}

/** `1.2K` where space is short, with the exact value as its accessible name and native tooltip. */
export const CompactNumber = ({ value, className }: CompactNumberProps) => {
  const exact = value.toLocaleString();
  const compact = formatCount(value);

  return (
    <span className={cn('tabular-nums', className)} title={compact === exact ? undefined : exact} aria-label={compact === exact ? undefined : exact}>
      {compact}
    </span>
  );
};
