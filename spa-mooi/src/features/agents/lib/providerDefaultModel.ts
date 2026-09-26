import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

/** The model the provider falls back to when no default is configured. */
export const providerDefaultModel = (catalog: SessionProvider) =>
  catalog.models.find((model) => model.id === (catalog.providerDefaultModel ?? catalog.defaultModel));
