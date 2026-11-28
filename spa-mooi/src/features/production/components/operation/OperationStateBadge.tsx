import { OPERATION_STATE_VIEWS } from '@/features/production/components/operation/operationStateView';
import type { ProductionDeploymentState } from '@/features/production/types/ProductionDeploymentState';
import { Badge } from '@/shared/components/data-display/Badge';
import { cn } from '@/shared/utils/cn';

/** The outcome of one deployment or backup operation as a labelled badge. */
export const OperationStateBadge = ({ state, className }: { state: ProductionDeploymentState; className?: string }) => {
  const view = OPERATION_STATE_VIEWS[state];
  return <Badge tone={view.tone} icon={view.icon} className={cn(state === 'running' && '[&>svg]:animate-spin', className)}>{view.label}</Badge>;
};
