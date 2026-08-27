import { cn } from '@/shared/utils/cn';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-500 hover:shadow-xl hover:shadow-indigo-500/35',
  secondary:
    'border border-slate-200 bg-white/70 text-slate-700 backdrop-blur hover:border-slate-300 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/10',
};

export const buttonStyles = (variant: ButtonVariant, className?: string): string =>
  cn(base, variants[variant], className);
