import type { ButtonSize } from '@/shared/types/ButtonSize';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';
import { cn } from '@/shared/utils/cn';

/**
 * Press feedback is a transform, so it never triggers layout and stays smooth on low-end phones.
 * The `before` box grows the hit area to 44 px tall without changing the layout.
 */
const base =
  "relative inline-flex min-w-0 items-center justify-center gap-2 rounded-control font-semibold tracking-[-0.005em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-standard before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:bg-surface-3 disabled:bg-none disabled:text-ink-subtle disabled:border-transparent disabled:shadow-none aria-busy:pointer-events-none";

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5.5 text-[15px]',
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-contrast text-contrast-ink shadow-raised hover-device:hover:bg-contrast/88',
  brand: 'bg-brand-gradient text-white shadow-brand inset-shadow-[0_1px_0_rgb(255_255_255/0.2)] hover-device:hover:brightness-110',
  tinted: 'bg-brand-soft text-brand-strong hover-device:hover:bg-brand-soft/70',
  secondary: 'border border-line bg-surface text-ink shadow-card hover-device:hover:border-line-strong hover-device:hover:bg-surface-2',
  ghost: 'text-ink-muted hover-device:hover:bg-surface-2 hover-device:hover:text-ink active:bg-surface-2',
  danger: 'border border-danger/30 bg-surface text-danger hover-device:hover:border-danger/50 hover-device:hover:bg-danger-soft',
};

export const buttonStyles = (
  variant: ButtonVariant,
  size: ButtonSize = 'md',
  className?: string,
): string => cn(base, sizes[size], variants[variant], className);
