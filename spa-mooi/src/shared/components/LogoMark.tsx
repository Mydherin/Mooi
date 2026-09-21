import { cn } from '@/shared/utils/cn';

interface LogoMarkProps {
  className?: string;
}

export const LogoMark = ({ className }: LogoMarkProps) => (
  <svg viewBox="0 0 64 64" role="img" aria-hidden className={cn('size-8', className)}>
    <rect width="64" height="64" rx="18" className="fill-contrast" />
    <path
      d="M16 46V20l16 17 16-17v26"
      fill="none"
      className="stroke-contrast-ink"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
