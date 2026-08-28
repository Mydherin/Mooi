import type { EnvironmentSummary } from '@/features/projects/types/EnvironmentSummary';

export const environments: EnvironmentSummary[] = [
  {
    id: 'production',
    name: 'Production',
    url: 'aurora.mooi.app',
    branch: 'main',
    status: 'live',
    lastDeployLabel: 'Last deploy 2h ago',
  },
  {
    id: 'preview',
    name: 'Preview',
    url: 'checkout-flow.aurora.mooi.app',
    branch: 'feat/checkout-flow',
    status: 'building',
    lastDeployLabel: 'Updated 12s ago',
  },
];
