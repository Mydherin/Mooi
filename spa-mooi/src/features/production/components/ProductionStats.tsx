import { Activity, FileCode2, History, Tag } from 'lucide-react';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import type { ProductionHealth } from '@/features/production/types/ProductionHealth';
import type { ProductionHealthState } from '@/features/production/types/ProductionHealthState';
import type { ProductionOverview } from '@/features/production/types/ProductionOverview';
import { WorkspaceStat } from '@/features/sessions/components/workspaces/WorkspaceStat';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface ProductionStatsProps {
  overview: ProductionOverview;
  latest: ProductionDeployment | undefined;
  healthState: ProductionHealthState;
  health: ProductionHealth | null;
  healthError: string | null;
}

const SERVICE_LABELS: Record<ProductionHealthState, string> = {
  unknown: 'Unknown', checking: 'Checking…', healthy: 'Online', unhealthy: 'Needs attention',
};

/** Four numbers that answer "what is live and is it healthy?" at a glance. */
export const ProductionStats = ({ overview, latest, healthState, health, healthError }: ProductionStatsProps) => {
  const missing = overview.environment.filter((variable) => variable.required && !variable.configured).length;
  const configuration = overview.deployed ? overview.hasDraft ? 'Active + draft' : 'Active' : overview.configured ? 'Draft' : 'None';

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <WorkspaceStat icon={Tag} label="Release" value={latest?.releaseTag ?? '—'}
        hint={latest ? latest.state === 'succeeded' ? 'Last deployed version' : `Last attempt ${latest.state}` : 'Never deployed'} />
      <WorkspaceStat icon={History} label="Last deployment" value={latest ? formatRelativeTime(latest.finishedAt ?? latest.startedAt) : '—'}
        hint={latest?.finishedAt ? `Took ${formatDuration(latest.startedAt, latest.finishedAt)}` : latest ? 'In progress' : 'No history yet'} />
      <WorkspaceStat icon={Activity} label="Service" value={SERVICE_LABELS[healthState]}
        hint={healthError ?? (health ? `Checked ${formatRelativeTime(health.checkedAt)}` : overview.configured ? 'Runs status.sh' : 'Needs status.sh')} />
      <WorkspaceStat icon={FileCode2} label="Configuration" value={configuration}
        hint={missing > 0 ? `${missing} variable${missing === 1 ? '' : 's'} missing` : `${overview.environment.length} variable${overview.environment.length === 1 ? '' : 's'} · rev ${overview.revision}`} />
    </div>
  );
};
