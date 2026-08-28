import type { DeployTarget } from '@/features/sessions/types/DeployTarget';

export const deployTargets: DeployTarget[] = [
  {
    id: 'production',
    name: 'Production',
    url: 'aurora.mooi.app',
    branch: 'main',
    lastDeployLabel: 'last deploy 2h ago',
  },
  {
    id: 'preview',
    name: 'Preview',
    url: 'checkout-flow.aurora.mooi.app',
    branch: 'feat/checkout-flow',
    lastDeployLabel: 'last deploy 12m ago',
  },
];
