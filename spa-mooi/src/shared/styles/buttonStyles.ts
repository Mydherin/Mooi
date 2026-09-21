import type { ButtonSize } from '@/shared/types/ButtonSize';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';
import { cn } from '@/shared/utils/cn';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-bold whitespace-nowrap transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:bg-surface-3 disabled:text-ink-subtle disabled:border-transparent';

const sizes: Record<ButtonSize, string> = {
  sm: 'h-10 px-3.5 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5.5 text-[15px]',
};

/** `brand` resolves to the same black as `primary`: in Base every call to action is black. */
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-contrast text-contrast-ink hover:bg-contrast/88',
  brand: 'bg-contrast text-contrast-ink hover:bg-contrast/88',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border border-danger/35 bg-surface text-danger hover:bg-danger-soft',
};

export const buttonStyles = (
  variant: ButtonVariant,
  size: ButtonSize = 'md',
  className?: string,
): string => cn(base, sizes[size], variants[variant], className);
