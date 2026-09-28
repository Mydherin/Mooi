import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

/** The provider's configured default when it applies to this model, else the model's own default. */
export const defaultEffortFor = (provider: SessionProvider | undefined, model: string): string => {
  const entry = provider?.models.find((candidate) => candidate.id === model);
  if (!entry?.efforts.length) return '';
  if (model === provider?.defaultModel && provider.defaultEffort && entry.efforts.includes(provider.defaultEffort)) return provider.defaultEffort;
  if (entry.defaultEffort && entry.efforts.includes(entry.defaultEffort)) return entry.defaultEffort;
  return entry.efforts[0];
};
