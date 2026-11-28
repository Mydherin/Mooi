import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '@/shared/components/overlays/tooltip/Tooltip';
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

/** An icon segment attached to the right of the Deploy button; phones reach it from the session actions menu. */
export const DeployGroupButton = ({ icon: Icon, label, onClick, last, disabled = false, active = false, expanded, controls }: DeployGroupButtonProps) => (
  <Tooltip content={label} mono={false} className="max-sm:hidden"><button type="button" aria-label={label} aria-expanded={expanded} aria-controls={controls}
    disabled={disabled} onClick={onClick}
    className={cn('relative inline-flex h-10 w-10 shrink-0 items-center justify-center border border-l-0 border-line bg-surface text-ink-muted transition active:bg-surface-2 hover-device:hover:bg-surface-2 hover-device:hover:text-ink focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
      last && 'rounded-r-control')}
  >
    <Icon className="size-4.5" />
    {active ? <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-success-dot" aria-hidden="true" /> : null}
  </button></Tooltip>
);
