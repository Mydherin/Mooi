import type { ButtonHTMLAttributes, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { cn } from '@/shared/utils/cn';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  /** Accessible name, also shown as the native tooltip. Required: an icon alone says nothing. */
  label: string;
  /** Pressed / open state (a toggle, the trigger of an open menu). */
  active?: boolean;
  variant?: 'ghost' | 'secondary' | 'tinted';
  size?: 'sm' | 'md';
  loading?: boolean;
  /** Attention dot in the corner. */
  indicator?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const variants = {
  ghost: 'text-ink-muted hover-device:hover:bg-surface-2 hover-device:hover:text-ink',
  secondary: 'border border-line bg-surface text-ink-muted shadow-card hover-device:hover:border-line-strong hover-device:hover:text-ink',
  tinted: 'bg-brand-soft text-brand-strong',
};

/** A square icon control. `sm` is 36 px with a 44 px hit area; `md` is 40 px. */
export const IconButton = ({ icon: Icon, label, active = false, variant = 'ghost', size = 'md', loading = false,
  indicator = false, className, type = 'button', ref, disabled, ...rest }: IconButtonProps) => (
  <button
    {...rest}
    ref={ref}
    type={type}
    disabled={disabled}
    aria-label={label}
    aria-busy={loading || undefined}
    title={label}
    className={cn(
      "relative inline-flex shrink-0 items-center justify-center rounded-control transition-[background-color,color,transform,opacity] duration-150 before:absolute before:content-[''] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-45",
      size === 'sm' ? 'size-9 before:-inset-1' : 'size-10 before:-inset-0.5',
      active ? 'bg-surface-2 text-ink' : variants[variant],
      className,
    )}
  >
    {loading ? <Spinner className="size-4.5" /> : <Icon aria-hidden className="size-4.5" />}
    {indicator ? <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-danger-dot ring-2 ring-surface" /> : null}
  </button>
);
