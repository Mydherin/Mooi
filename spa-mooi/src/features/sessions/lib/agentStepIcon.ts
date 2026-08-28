import { FileCode, FileDiff, FilePlus, Rocket, Search, Terminal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentStepKind } from '@/features/sessions/types/AgentStepKind';

const icons: Record<AgentStepKind, LucideIcon> = {
  read: FileCode,
  search: Search,
  edit: FileDiff,
  create: FilePlus,
  run: Terminal,
  deploy: Rocket,
};

export const agentStepIcon = (kind: AgentStepKind): LucideIcon => icons[kind];
