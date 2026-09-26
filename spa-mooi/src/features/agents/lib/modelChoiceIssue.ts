import { providerDefaultModel } from '@/features/agents/lib/providerDefaultModel';
import type { ModelChoice } from '@/features/agents/types/ModelChoice';
import type { ModelChoiceIssue } from '@/features/agents/types/ModelChoiceIssue';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

export const modelChoiceIssue = (choice: ModelChoice, catalog: SessionProvider | null): ModelChoiceIssue | null => {
  if (!catalog) return null;
  const model = choice.model ? catalog.models.find((entry) => entry.id === choice.model) : providerDefaultModel(catalog);
  if (choice.model && !model) return 'model';
  if (choice.effort && !(model?.efforts ?? []).includes(choice.effort)) return 'effort';
  return null;
};
