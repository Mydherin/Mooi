import { ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { projectStatusLabel, projectStatusTone } from '@/features/projects/lib/projectStatusTone';
import type { EnvironmentSummary } from '@/features/projects/types/EnvironmentSummary';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { StatusDot } from '@/shared/components/StatusDot';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface EnvironmentCardProps {
  environment: EnvironmentSummary;
}

export const EnvironmentCard = ({ environment }: EnvironmentCardProps) => (
  <Card className="flex flex-col p-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-tight text-ink">{environment.name}</h3>
      <span className="flex items-center gap-2 text-xs text-ink-muted">
        <StatusDot
          tone={projectStatusTone(environment.status)}
          pulse={environment.status === 'building'}
        />
        {projectStatusLabel(environment.status)}
      </span>
    </div>

    <a
      href={`https://${environment.url}`}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <Globe className="size-3.5 shrink-0" />
      <span className="truncate">{environment.url}</span>
    </a>

    <p className="mt-2 truncate font-mono text-xs text-ink-subtle">{environment.branch}</p>
    <p className="mt-1 text-xs text-ink-subtle">{environment.lastDeployLabel}</p>

    <div className="mt-5 flex items-center gap-2">
      <a
        href={`https://${environment.url}`}
        target="_blank"
        rel="noreferrer"
        className={buttonStyles('ghost', 'sm')}
      >
        <ExternalLink className="size-4" />
        Open
      </a>
      <Button variant="ghost" size="sm">
        <RefreshCw className="size-4" />
        Rollback
      </Button>
    </div>
  </Card>
);
