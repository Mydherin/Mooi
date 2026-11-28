import { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deploymentPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import { OperationStateIcon } from '@/features/production/components/operation/OperationStateIcon';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface ProductionHistoryListProps {
  deployments: ProductionDeployment[];
  projects: Map<string, Project>;
  onOpen: (deployment: ProductionDeployment) => void;
}

const HistoryRow = memo(({ deployment, project, onOpen }: { deployment: ProductionDeployment; project: Project | undefined; onOpen: (deployment: ProductionDeployment) => void }) => {
  const navigate = useNavigate();
  return <ListRow onClick={() => onOpen(deployment)} chevron leading={<OperationStateIcon state={deployment.state} />}
    title={project?.name ?? 'Removed project'}
    subtitle={<><span className="font-mono text-ink-muted">{deployment.releaseTag}</span> · {formatRelativeTime(deployment.startedAt)}
      {deployment.finishedAt ? ` · ${formatDuration(deployment.startedAt, deployment.finishedAt)}` : ''}</>}
    trailing={<OperationStateBadge state={deployment.state} className="max-sm:hidden" />}
    swipeActions={project ? [{ id: 'open', label: 'Project', icon: ArrowUpRight, onSelect: () => navigate(deploymentPath(project.id)) }] : undefined} />;
});
HistoryRow.displayName = 'HistoryRow';

/** Every recorded deployment across projects, newest first; the detail leads on to its project. */
export const ProductionHistoryList = ({ deployments, projects, onOpen }: ProductionHistoryListProps) => (
  <ListGroup>
    {deployments.map((deployment) => <HistoryRow key={deployment.operationId} deployment={deployment}
      project={projects.get(deployment.projectId)} onOpen={onOpen} />)}
  </ListGroup>
);
