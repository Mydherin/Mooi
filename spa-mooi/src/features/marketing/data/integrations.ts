import { Bot, Container, Cpu, Database, FolderGit2, Globe, Sparkles } from 'lucide-react';
import type { Integration } from '@/features/marketing/types/Integration';

export const integrations: Integration[] = [
  { id: 'github', label: 'GitHub', icon: FolderGit2 },
  { id: 'claude', label: 'Claude', icon: Bot },
  { id: 'openai', label: 'OpenAI', icon: Cpu },
  { id: 'gemini', label: 'Gemini', icon: Sparkles },
  { id: 'docker', label: 'Docker', icon: Container },
  { id: 'postgres', label: 'Postgres', icon: Database },
  { id: 'vercel', label: 'Vercel', icon: Globe },
];
