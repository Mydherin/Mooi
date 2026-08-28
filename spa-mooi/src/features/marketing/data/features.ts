import { AppWindow, Bot, FileDiff, FolderGit2, MessagesSquare, Rocket } from 'lucide-react';
import type { MarketingFeature } from '@/features/marketing/types/MarketingFeature';

export const features: MarketingFeature[] = [
  {
    id: 'projects',
    title: 'GitHub-synced projects',
    description:
      'Import a repository once; branches, commits and pull requests stay in step with every session.',
    icon: FolderGit2,
  },
  {
    id: 'sessions',
    title: 'Sessions with real context',
    description:
      'Each change gets its own session, its own branch and a history you can come back to.',
    icon: MessagesSquare,
  },
  {
    id: 'providers',
    title: 'Bring your own agent',
    description:
      'Claude, GPT, Gemini or a local provider — pick the model per session, switch it mid-run.',
    icon: Bot,
  },
  {
    id: 'preview',
    title: 'Live preview, always on',
    description:
      'Your application runs beside the conversation and refreshes as soon as a file changes.',
    icon: AppWindow,
  },
  {
    id: 'diffs',
    title: 'Diffs you can actually read',
    description:
      'Review every added, edited and deleted file before a single line reaches your branch.',
    icon: FileDiff,
  },
  {
    id: 'deploy',
    title: 'Deploy in one click',
    description:
      'Promote a session to an environment, with deploy history and one-click rollback.',
    icon: Rocket,
  },
];
