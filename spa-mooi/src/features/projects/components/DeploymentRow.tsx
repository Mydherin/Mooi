import type { Deployment } from '@/features/projects/types/Deployment';
import type { DeploymentStatus } from '@/features/projects/types/DeploymentStatus';
import { Badge } from '@/shared/components/Badge';
import type { Tone } from '@/shared/types/Tone';

interface DeploymentRowProps {
  deployment: Deployment;
}

const tones: Record<DeploymentStatus, Tone> = {
  succeeded: 'success',
  running: 'info',
  failed: 'danger',
};

const labels: Record<DeploymentStatus, string> = {
  succeeded: 'Succeeded',
  running: 'Running',
  failed: 'Failed',
};

export const DeploymentRow = ({ deployment }: DeploymentRowProps) => (
  <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
    <Badge tone={deployment.environment === 'production' ? 'brand' : 'neutral'}>
      {deployment.environment}
    </Badge>

    <span className="font-mono text-xs text-ink-subtle">{deployment.sha}</span>

    <span className="min-w-0 flex-1 basis-full truncate text-sm text-ink sm:basis-0">
      {deployment.message}
    </span>

    <Badge tone={tones[deployment.status]}>{labels[deployment.status]}</Badge>

    <span className="text-xs text-ink-subtle">{deployment.duration}</span>
    <span className="text-xs text-ink-subtle">{deployment.timeLabel}</span>
  </li>
);
