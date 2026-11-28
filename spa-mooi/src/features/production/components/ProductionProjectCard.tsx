import { memo } from 'react';
import { deploymentPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import { Badge } from '@/shared/components/data-display/Badge';
import { Initials } from '@/shared/components/data-display/Initials';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface ProductionProjectCardProps {
  project: Project;
  latest: ProductionDeployment | undefined;
}

/** A project on the deployments landing: its last release and outcome, opening its production view. */
export const ProductionProjectCard = memo(({ project, latest }: ProductionProjectCardProps) => (
  <ListRow to={deploymentPath(project.id)} leading={<Initials value={project.name} size="md" />} title={project.name}
    subtitle={latest ? <><span className="font-mono text-ink-muted">{latest.releaseTag}</span> · {formatRelativeTime(latest.finishedAt ?? latest.startedAt)}</> : 'Set up production'}
    trailing={latest ? <OperationStateBadge state={latest.state} /> : <Badge>Not deployed</Badge>} />
));
ProductionProjectCard.displayName = 'ProductionProjectCard';
