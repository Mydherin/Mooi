import { Bot, FolderGit2, UserRound } from 'lucide-react';
import type { Connection } from '@/features/account/types/Connection';

export const connections: Connection[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repositories and pull requests',
    icon: FolderGit2,
    connected: true,
    action: 'Manage',
  },
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
