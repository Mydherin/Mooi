import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/shared/types/Tone';
import { toneStyles } from '@/shared/styles/toneStyles';
import { cn } from '@/shared/utils/cn';

interface OperationStatusCardProps {
  icon: LucideIcon;
  tone: Tone;
  /** The icon spins: something is running. */
  busy: boolean;
  title: ReactNode;
  description: ReactNode;
  /** The single next step (and at most one secondary), full width on phones. */
  actions?: ReactNode;
  /** Below the text: the setup steps, a prompt. */
  children?: ReactNode;
}

/**
 * Where a project's production or backups stand and the one thing to do next. The project itself is
 * named by the screen header, so this card only tells the story of its current stage. Key it by stage
 * so each change fades in.
 */
export const OperationStatusCard = ({ icon: Icon, tone, busy, title, description, actions, children }: OperationStatusCardProps) => (
  <section aria-live="polite" className="relative min-w-0 animate-fade-in overflow-hidden rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
    <div aria-hidden className={cn('pointer-events-none absolute -top-28 -right-24 size-64 rounded-full border-0 opacity-50 blur-3xl', toneStyles(tone))} />
    <div className="relative flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl border', toneStyles(tone))}>
            <Icon aria-hidden className={cn('size-6', busy && 'animate-spin')} />
          </span>
          <div className="min-w-0">
            <h2 className="text-headline break-words text-ink sm:text-title">{title}</h2>
            <p className="mt-1 max-w-xl text-callout text-ink-muted">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end [&>*]:max-sm:w-full">{actions}</div> : null}
      </div>
      {children}
    </div>
  </section>
);
