import type { ButtonSize } from '@/shared/types/ButtonSize';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';
import { cn } from '@/shared/utils/cn';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-55';

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-contrast text-contrast-ink hover:bg-contrast/90',
  brand: 'bg-brand text-brand-ink hover:bg-brand-strong shadow-[0_10px_30px_-14px_var(--brand)]',
  secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border border-danger/40 bg-danger-soft text-danger hover:bg-danger/15',
};

export const buttonStyles = (
  variant: ButtonVariant,
  size: ButtonSize = 'md',
  className?: string,
): string => cn(base, sizes[size], variants[variant], className);
