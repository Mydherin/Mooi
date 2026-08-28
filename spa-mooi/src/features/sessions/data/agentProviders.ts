import type { AgentProvider } from '@/features/sessions/types/AgentProvider';

export const agentProviders: AgentProvider[] = [
  { id: 'claude-opus', label: 'Claude Opus' },
  { id: 'claude-sonnet', label: 'Claude Sonnet' },
  { id: 'gpt-5', label: 'GPT-5' },
  { id: 'gemini-pro', label: 'Gemini Pro' },
  { id: 'local', label: 'Local provider' },
];
