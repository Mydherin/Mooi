import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface DeployGroupButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Closes the deploy group with the rounded right edge. */
  last: boolean;
  disabled?: boolean;
  /** Live-activity dot on the icon. */
  active?: boolean;
  expanded?: boolean;
  controls?: string;
}

/** An icon segment attached to the right of the Deploy button. */
export const DeployGroupButton = ({ icon: Icon, label, onClick, last, disabled = false, active = false, expanded, controls }: DeployGroupButtonProps) => (
  <button type="button" aria-label={label} title={label} aria-expanded={expanded} aria-controls={controls}
    disabled={disabled} onClick={onClick}
    className={cn('relative inline-flex h-10 w-10 shrink-0 items-center justify-center border border-l-0 border-line bg-surface text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
      last && 'rounded-r-[10px]')}
  >
    <Icon className="size-4.5" />
    {active ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
  </button>
);
