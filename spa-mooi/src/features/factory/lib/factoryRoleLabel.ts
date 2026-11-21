import type { FactoryRole } from '@/features/factory/types/FactoryRole';

const LABELS: Record<FactoryRole, string> = {
  chat: 'Factory chat',
  architect: 'Architect',
  planner: 'Planner',
  builder: 'Builder',
  tester: 'Tester',
  merger: 'Merger',
  analyst: 'Analyst',
};

export const factoryRoleLabel = (role: FactoryRole): string => LABELS[role] ?? role;
