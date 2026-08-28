import type { ReactNode } from 'react';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import type { ButtonSize } from '@/shared/types/ButtonSize';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  onClick,
  disabled = false,
  className,
  ariaLabel,
}: ButtonProps) => (
  <button
    type={type === 'submit' ? 'submit' : 'button'}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={buttonStyles(variant, size, className)}
  >
    {children}
  </button>
);
