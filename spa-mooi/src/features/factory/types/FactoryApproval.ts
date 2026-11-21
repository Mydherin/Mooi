import type { Factory } from '@/features/factory/types/Factory';
import type { FactoryIssue } from '@/features/factory/types/FactoryIssue';

/** The approval gate's answer: approved, or what still blocks it. */
export interface FactoryApproval {
  approved: boolean;
  issues: FactoryIssue[];
  factory: Factory;
}
