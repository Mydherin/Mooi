import { MODEL_PURPOSES } from '@/features/agents/lib/modelPurposes';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';

export const sameModelDefaults = (left: ModelDefaults, right: ModelDefaults): boolean =>
  MODEL_PURPOSES.every(({ id }) => left[id].model === right[id].model && left[id].effort === right[id].effort);
