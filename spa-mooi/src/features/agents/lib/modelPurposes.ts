import { MessageSquarePlus, Rocket } from 'lucide-react';
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
  {
    id: 'deployment',
    label: 'Deployment',
    description: 'Runs the agent that prepares and ships a deployment.',
    icon: Rocket,
    missingFallback: 'Deployments will use the provider default.',
  },
];
