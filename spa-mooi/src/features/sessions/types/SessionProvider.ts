import type { AgentAdapter } from '@/features/sessions/types/AgentAdapter';

export interface SessionProvider {
  id: string;
  label: string;
  defaultModel: string;
  providerDefaultModel?: string;
  defaultEffort: string | null;
  /** The platform's context handover percent for new sessions of this provider; `null` is off. */
  defaultContextHandover?: number | null;
  unavailable?: string;
  /** The adapter this catalog belongs to, and every adapter the provider offers (the first is its default). */
  adapter?: string;
  adapters?: AgentAdapter[];
  models: { id: string; label: string; efforts: string[]; defaultEffort?: string; images?: boolean }[];
}
