import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import type { ProductionDeploymentState } from '@/features/production/types/ProductionDeploymentState';
import { Badge } from '@/shared/components/Badge';

const VIEWS = {
  running: { label: 'Running', tone: 'info', icon: LoaderCircle },
  succeeded: { label: 'Succeeded', tone: 'success', icon: CircleCheck },
  failed: { label: 'Failed', tone: 'danger', icon: CircleAlert },
} as const;

export const DeploymentStateBadge = ({ state }: { state: ProductionDeploymentState }) => {
  const view = VIEWS[state];
  return <Badge tone={view.tone} icon={view.icon}>{view.label}</Badge>;
};
