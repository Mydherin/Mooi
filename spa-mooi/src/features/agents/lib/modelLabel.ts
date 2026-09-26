import type { ModelChoice } from '@/features/agents/types/ModelChoice';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

/** How a choice reads in a compact summary: its model label, or "Default" when it inherits. */
export const modelLabel = (choice: ModelChoice, catalog: SessionProvider | null): string =>
  choice.model ? catalog?.models.find((model) => model.id === choice.model)?.label ?? choice.model : 'Default';
