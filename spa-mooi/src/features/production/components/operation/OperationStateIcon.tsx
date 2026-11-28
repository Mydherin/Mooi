import { OPERATION_STATE_VIEWS } from '@/features/production/components/operation/operationStateView';
import type { ProductionDeploymentState } from '@/features/production/types/ProductionDeploymentState';
import { toneStyles } from '@/shared/styles/toneStyles';
import { cn } from '@/shared/utils/cn';

/** The outcome of one operation as a tinted tile, the leading visual of its row. */
export const OperationStateIcon = ({ state, className }: { state: ProductionDeploymentState; className?: string }) => {
  const { icon: Icon, tone, label } = OPERATION_STATE_VIEWS[state];
  return <span role="img" aria-label={label} className={cn('flex size-9 shrink-0 items-center justify-center rounded-control border', toneStyles(tone), className)}>
    <Icon aria-hidden className={cn('size-4', state === 'running' && 'animate-spin')} />
  </span>;
};
