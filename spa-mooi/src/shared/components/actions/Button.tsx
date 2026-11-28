import type { MouseEvent, ReactNode, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import type { ButtonSize } from '@/shared/types/ButtonSize';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';
import { cn } from '@/shared/utils/cn';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit';
  form?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Work in flight: a spinner replaces the icon and the button ignores presses (`aria-busy`). */
  loading?: boolean;
  /** Leading icon; replaced by the spinner while loading. */
  icon?: LucideIcon;
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  form,
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  fullWidth = false,
  className,
  ariaLabel,
  ref,
}: ButtonProps) => (
  <button
    ref={ref}
    type={type === 'submit' ? 'submit' : 'button'}
    form={form}
    onClick={onClick}
    disabled={disabled}
    aria-busy={loading || undefined}
    aria-label={ariaLabel}
    className={buttonStyles(variant, size, cn(fullWidth && 'w-full', className))}
  >
    {loading ? <Spinner /> : Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
    {children}
  </button>
);
