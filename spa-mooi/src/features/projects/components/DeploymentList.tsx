import { DeploymentRow } from '@/features/projects/components/DeploymentRow';
import type { Deployment } from '@/features/projects/types/Deployment';
import { Card } from '@/shared/components/Card';

interface DeploymentListProps {
  deployments: Deployment[];
}

export const DeploymentList = ({ deployments }: DeploymentListProps) => (
  <Card as="section" className="overflow-hidden">
    <div className="border-b border-line px-4 py-3 sm:px-5">
      <h2 className="text-sm font-semibold tracking-tight text-ink">Deployments</h2>
    </div>

    <ul className="divide-y divide-line">
      {deployments.map((deployment) => (
        <DeploymentRow key={deployment.id} deployment={deployment} />
      ))}
    </ul>
  </Card>
);
