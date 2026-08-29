import { Bot, UserRound } from 'lucide-react';
import type { Connection } from '@/features/account/types/Connection';

/** GitHub is deliberately absent: that connection is live and owned by its own card. */
export const connections: Connection[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Sign-in identity',
    icon: UserRound,
    connected: true,
    action: 'Manage',
  },
  {
    id: 'agent-provider',
    name: 'Agent provider',
    description: 'Claude, GPT, Gemini',
    icon: Bot,
    connected: false,
    action: 'Configure',
  },
];
