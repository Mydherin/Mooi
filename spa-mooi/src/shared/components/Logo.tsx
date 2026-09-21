import { env } from '@/config/env';
import { LogoMark } from '@/shared/components/LogoMark';

interface LogoProps {
  compact?: boolean;
}

export const Logo = ({ compact = false }: LogoProps) => (
  <span className="flex items-center gap-2.5">
    <LogoMark className="size-8" />
    {compact ? null : (
      <span className="text-lg font-semibold tracking-tight text-current">{env.appName}</span>
    )}
  </span>
);
