import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** A trailing action (Retry, Learn more). */
  action?: ReactNode;
  className?: string;
}

const tones: Record<AlertTone, { box: string; icon: LucideIcon; ink: string }> = {
  info: { box: 'border-info/25 bg-info-soft', icon: Info, ink: 'text-info' },
  success: { box: 'border-success/25 bg-success-soft', icon: CircleCheck, ink: 'text-success' },
  warning: { box: 'border-warning/30 bg-warning-soft', icon: TriangleAlert, ink: 'text-warning' },
  danger: { box: 'border-danger/30 bg-danger-soft', icon: CircleAlert, ink: 'text-danger' },
};

/** Inline, persistent feedback inside a screen or dialog (an error to act on, a warning). Errors are announced. */
export const Alert = ({ tone = 'info', title, children, action, className }: AlertProps) => {
  const { box, icon: Icon, ink } = tones[tone];

  return (
    <div role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex min-w-0 items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-footnote', box, className)}>
      <Icon aria-hidden className={cn('mt-px size-4 shrink-0', ink)} />
      <div className="min-w-0 flex-1 break-words text-ink">
        {title ? <p className={cn('font-semibold', ink)}>{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', !title && tone === 'danger' && 'text-danger')}>{children}</div> : null}
      </div>
      {action ? <div className="-my-1 shrink-0">{action}</div> : null}
    </div>
  );
};
