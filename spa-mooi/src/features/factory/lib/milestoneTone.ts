import type { FactoryMilestone } from '@/features/factory/types/FactoryMilestone';
import type { Tone } from '@/shared/types/Tone';

export const milestoneTone = (milestone: FactoryMilestone): Tone => {
  switch (milestone.status) {
    case 'done': return 'success';
    case 'attention': return 'danger';
    case 'testing': return milestone.test === 'passed' ? 'success' : 'info';
    case 'building': return milestone.test === 'failed' ? 'warning' : 'brand';
    case 'reopened': return 'warning';
    default: return 'neutral';
  }
};
