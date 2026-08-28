import type { Deployment } from '@/features/projects/types/Deployment';

export const deployments: Deployment[] = [
  {
    id: 'dep-1',
    environment: 'production',
    sha: '9f2c1ab',
    message: 'Rebuild checkout flow',
    status: 'succeeded',
    duration: '1m 42s',
    timeLabel: '2h ago',
    author: 'mydherin',
  },
  {
    id: 'dep-2',
    environment: 'preview',
    sha: '3ba77e0',
    message: 'Add per-key rate limiting',
    status: 'running',
    duration: '46s',
    timeLabel: '12m ago',
    author: 'mydherin',
  },
  {
    id: 'dep-3',
    environment: 'preview',
    sha: '71dd904',
    message: 'Ship the dark theme',
    status: 'succeeded',
    duration: '1m 08s',
    timeLabel: '5h ago',
    author: 'mydherin',
  },
  {
    id: 'dep-4',
    environment: 'production',
    sha: 'c05f1e2',
    message: 'Fix iOS release build',
    status: 'failed',
    duration: '2m 11s',
    timeLabel: 'yesterday',
    author: 'mydherin',
  },
];
