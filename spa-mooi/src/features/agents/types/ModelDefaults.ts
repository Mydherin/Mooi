import type { ModelChoice } from '@/features/agents/types/ModelChoice';
import type { ModelPurposeId } from '@/features/agents/types/ModelPurposeId';

export type ModelDefaults = Record<ModelPurposeId, ModelChoice>;
