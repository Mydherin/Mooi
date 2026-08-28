import { Eye, FolderGit2, MessagesSquare, Rocket, WandSparkles } from 'lucide-react';
import type { WorkflowStep } from '@/features/marketing/types/WorkflowStep';

export const workflowSteps: WorkflowStep[] = [
  {
    id: 'connect',
    title: 'Connect',
    description: 'Sign in and import a GitHub repository into your workspace.',
    icon: FolderGit2,
  },
  {
    id: 'session',
    title: 'Open a session',
    description: 'Describe the change. The session gets its own branch and context.',
    icon: MessagesSquare,
  },
  {
    id: 'build',
    title: 'Build with the agent',
    description: 'Watch it read files, edit code and run commands, step by step.',
    icon: WandSparkles,
  },
  {
    id: 'review',
    title: 'Review & preview',
    description: 'Read the diff, click through the running app in the preview frame.',
    icon: Eye,
  },
  {
    id: 'deploy',
    title: 'Deploy',
    description: 'Promote to production, or push the branch back to GitHub.',
    icon: Rocket,
  },
];
