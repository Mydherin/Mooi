import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { deploymentPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { DeploymentStateBadge } from '@/features/production/components/DeploymentStateBadge';
import { ProductionTargetLink } from '@/features/production/components/ProductionTargetLink';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import { Badge } from '@/shared/components/Badge';
import { Initials } from '@/shared/components/Initials';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface ProductionProjectCardProps {
  project: Project;
  latest: ProductionDeployment | undefined;
}

/** A project on the deployments landing: its last release and outcome, opening its production view. */
export const ProductionProjectCard = ({ project, latest }: ProductionProjectCardProps) => {
  const target = latest && latest.state === 'succeeded' ? latest.targets[0] : undefined;
  const extraTargets = latest?.targets.length ? latest.targets.length - 1 : 0;
  return <article className="group flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised sm:gap-5 sm:p-5">
    <Link to={deploymentPath(project.id)}
      className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <Initials value={project.name} size="md" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-ink">{project.name}</h3>
        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-subtle">{project.fullName}</p>
      </div>
      <ArrowUpRight className="size-4 shrink-0 self-start text-ink-subtle transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
    {target ? <ProductionTargetLink target={target} extraTargets={extraTargets} className="max-w-full self-start" /> : null}
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 sm:pt-4">
      {latest ? <DeploymentStateBadge state={latest.state} /> : <Badge>Not deployed</Badge>}
      <span className="min-w-0 truncate text-right text-xs text-ink-muted">
        {latest ? <><span className="font-mono font-bold text-ink">{latest.releaseTag}</span> · {formatRelativeTime(latest.finishedAt ?? latest.startedAt)}</> : 'Set up production'}
      </span>
    </div>
  </article>;
};
