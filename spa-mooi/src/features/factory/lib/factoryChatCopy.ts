import type { PlatformAgentCopy } from '@/features/platform/types/PlatformAgentCopy';

/** The dialog that opens the factory chat: as the architect while defining, to steer afterwards. */
export const FACTORY_CHAT_COPY: Record<'define' | 'steer', PlatformAgentCopy> = {
  define: {
    title: 'Define the factory',
    description: 'an architect agent defines the project with you',
    label: 'What should the project become?',
    placeholder: 'Goals, users, must-haves, constraints… The architect asks about the rest.',
    action: 'Open chat',
  },
  steer: {
    title: 'Factory chat',
    description: 'discuss the plan, decide changes, pause or resume',
    label: 'What do you want to discuss? (optional)',
    placeholder: 'e.g. Why is milestone 03 in attention? / Add CSV export to the reports phase.',
    action: 'Open chat',
  },
};
