import type { ReactNode } from 'react';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import type { ButtonSize } from '@/shared/types/ButtonSize';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';

interface ActionLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  external?: boolean;
  className?: string;
}

export const ActionLink = ({
  href,
  children,
  variant = 'primary',
  size = 'md',
  external = false,
  className,
}: ActionLinkProps) => (
  <a
    href={href}
    className={buttonStyles(variant, size, className)}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
  >
    {children}
  </a>
);
