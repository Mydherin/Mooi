import { factoryStatusPresentation } from '@/features/factory/lib/factoryStatusPresentation';
import type { Factory } from '@/features/factory/types/Factory';
import { StatusDot } from '@/shared/components/StatusDot';
import { toneStyles } from '@/shared/styles/toneStyles';
import { cn } from '@/shared/utils/cn';

export const FactoryStatusBadge = ({ factory, className }: { factory: Factory; className?: string }) => {
  const status = factoryStatusPresentation(factory);
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-semibold whitespace-nowrap',
      toneStyles(status.tone), className)}>
      <StatusDot tone={status.tone} pulse={status.live} />
      {status.label}
    </span>
  );
};
