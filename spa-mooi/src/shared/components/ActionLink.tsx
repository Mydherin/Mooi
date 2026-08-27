import type { ReactNode } from 'react';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';

interface ActionLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  external?: boolean;
  className?: string;
}

export const ActionLink = ({
  href,
  children,
  variant = 'primary',
  external = false,
  className,
}: ActionLinkProps) => (
  <a
    href={href}
    className={buttonStyles(variant, className)}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
  >
    {children}
  </a>
);
