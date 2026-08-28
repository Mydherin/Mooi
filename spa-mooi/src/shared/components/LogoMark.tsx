import { useId } from 'react';
import { cn } from '@/shared/utils/cn';

interface LogoMarkProps {
  className?: string;
}

export const LogoMark = ({ className }: LogoMarkProps) => {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 64 64" role="img" aria-hidden className={cn('size-8', className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b45f0" />
          <stop offset="50%" stopColor="#8b7bff" />
          <stop offset="100%" stopColor="#6cb8ff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path
        d="M16 46V22l16 13 16-13v24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
