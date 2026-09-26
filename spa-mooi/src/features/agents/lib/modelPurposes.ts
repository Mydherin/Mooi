import { MessageSquarePlus } from 'lucide-react';
import type { ModelPurpose } from '@/features/agents/types/ModelPurpose';

/** Every action with a configurable default model; adding one here adds its section everywhere. */
export const MODEL_PURPOSES: ModelPurpose[] = [
  {
    id: 'session',
    label: 'New session',
    description: 'Preselected when someone starts a session with this account.',
    icon: MessageSquarePlus,
    missingFallback: 'New sessions will ask for a model manually.',
  },
];
