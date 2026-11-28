import { memo } from 'react';
import { RotateCcw } from 'lucide-react';
import { OperationStateIcon } from '@/features/production/components/operation/OperationStateIcon';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { Alert } from '@/shared/components/feedback/Alert';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface ProductionHistoryCardProps {
  deployments: ProductionDeployment[];
  loading: boolean;
  error: string | null;
  canRedeploy: boolean;
  onOpen: (deployment: ProductionDeployment) => void;
  onRedeploy: (deployment: ProductionDeployment) => void;
}

const RECENT = 8;

const DeploymentRow = memo(({ deployment, canRedeploy, onOpen, onRedeploy }: {
  deployment: ProductionDeployment; canRedeploy: boolean;
  onOpen: (deployment: ProductionDeployment) => void; onRedeploy: (deployment: ProductionDeployment) => void;
}) => (
  <ListRow onClick={() => onOpen(deployment)} chevron leading={<OperationStateIcon state={deployment.state} />}
    title={<span className="font-mono">{deployment.releaseTag}</span>}
    subtitle={`${formatRelativeTime(deployment.startedAt)} · ${deployment.finishedAt ? formatDuration(deployment.startedAt, deployment.finishedAt) : 'running'}`}
    swipeActions={canRedeploy && deployment.state !== 'running'
      ? [{ id: 'redeploy', label: 'Redeploy', icon: RotateCcw, onSelect: () => onRedeploy(deployment) }] : undefined} />
));
DeploymentRow.displayName = 'DeploymentRow';

/** Recent attempts of one project, newest first; each opens its detail (where it can be redeployed, also by swiping it). */
export const ProductionHistoryCard = ({ deployments, loading, error, canRedeploy, onOpen, onRedeploy }: ProductionHistoryCardProps) => (
  <ListGroup title="Deployments" action={deployments.length > 0 ? <span className="text-caption text-ink-subtle tabular-nums">{Math.min(deployments.length, RECENT)} recent</span> : undefined}
    footer={deployments.length === 0 && !loading && !error ? 'Every deployment appears here with its files and output.' : undefined}>
    {error ? <li className="p-3"><Alert tone="danger">{error}</Alert></li>
      : loading && deployments.length === 0 ? <li aria-busy className="p-4"><Skeleton lines={2} /></li>
        : deployments.length === 0 ? <li className="px-4 py-3.5 text-callout text-ink-muted">No deployments yet.</li>
          : deployments.slice(0, RECENT).map((deployment) => <DeploymentRow key={deployment.operationId} deployment={deployment}
            canRedeploy={canRedeploy} onOpen={onOpen} onRedeploy={onRedeploy} />)}
  </ListGroup>
);
