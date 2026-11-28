import { CircleAlert, CircleCheck, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ProductionDeploymentState } from '@/features/production/types/ProductionDeploymentState';
import type { Tone } from '@/shared/types/Tone';

interface OperationStateView {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

/** How a recorded deployment or backup operation reads: shared by both features, whose states match. */
export const OPERATION_STATE_VIEWS: Record<ProductionDeploymentState, OperationStateView> = {
  running: { label: 'Running', tone: 'info', icon: LoaderCircle },
  succeeded: { label: 'Succeeded', tone: 'success', icon: CircleCheck },
  failed: { label: 'Failed', tone: 'danger', icon: CircleAlert },
};
