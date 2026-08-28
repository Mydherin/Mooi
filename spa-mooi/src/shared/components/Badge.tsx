import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { toneStyles } from '@/shared/styles/toneStyles';
import type { Tone } from '@/shared/types/Tone';
import { cn } from '@/shared/utils/cn';

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}

export const Badge = ({ children, tone = 'neutral', icon: Icon, className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      toneStyles(tone),
      className,
    )}
  >
    {Icon ? <Icon className="size-3.5" /> : null}
    {children}
  </span>
);
