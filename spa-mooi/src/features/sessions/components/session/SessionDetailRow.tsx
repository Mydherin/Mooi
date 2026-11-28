import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CopyButton } from '@/shared/components/actions/CopyButton';
import { cn } from '@/shared/utils/cn';

interface SessionDetailRowProps {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  /** Code-like values (branches, paths) in mono; they wrap anywhere instead of truncating. */
  mono?: boolean;
  /** Offers a copy button for this exact value. */
  copy?: string;
}

/** One fact of the session details sheet: the full value always readable (it wraps), copyable when useful. */
export const SessionDetailRow = ({ icon: Icon, label, children, mono = false, copy }: SessionDetailRowProps) => (
  <li className="flex min-h-13 min-w-0 items-center gap-3 bg-surface px-4 py-2.5">
    <Icon aria-hidden className="size-4.5 shrink-0 text-ink-subtle" />
    <div className="min-w-0 flex-1">
      <p className="text-caption text-ink-subtle">{label}</p>
      <div className={cn('mt-0.5 text-callout text-ink [overflow-wrap:anywhere]', mono && 'font-mono text-mono')}>{children}</div>
    </div>
    {copy ? <CopyButton value={copy} label={`Copy ${label.toLowerCase()}`} /> : null}
  </li>
);
