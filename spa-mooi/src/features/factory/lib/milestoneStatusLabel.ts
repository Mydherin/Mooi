import type { FactoryMilestone } from '@/features/factory/types/FactoryMilestone';

export const milestoneStatusLabel = (milestone: FactoryMilestone): string => {
  switch (milestone.status) {
    case 'testing': return milestone.test === 'passed' ? 'Passed · merging' : 'Testing';
    case 'building': return milestone.test === 'failed' ? 'Fixing' : 'Building';
    case 'attention': return 'Needs you';
    case 'reopened': return 'Reopened';
    case 'done': return 'Done';
    default: return 'Planned';
  }
};
