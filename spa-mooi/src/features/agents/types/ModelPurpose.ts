import type { LucideIcon } from 'lucide-react';
import type { ModelPurposeId } from '@/features/agents/types/ModelPurposeId';

export interface ModelPurpose {
  id: ModelPurposeId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** What happens when the saved model disappears from the account's catalog. */
  missingFallback: string;
}
