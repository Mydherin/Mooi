import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface MenuActionProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

const tones = {
  default: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
};

export const MenuAction = ({ icon: Icon, label, onClick, disabled = false, tone = 'default' }: MenuActionProps) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm font-bold transition duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-55',
      tones[tone],
    )}
  >
    <Icon className="size-4 shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);
