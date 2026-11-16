import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { SuggestedCommitPreferences } from '@/features/account/types/SuggestedCommitPreferences';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const path = '/me/preferences/suggested-commit';

export const fetchSuggestedCommitPreferences = async (): Promise<SuggestedCommitPreferences> => {
  const response = await authenticatedFetch(path);
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not load suggested commit settings.'));
  return response.json();
};

export const saveSuggestedCommitPreferences = async (
  preferences: SuggestedCommitPreferences,
): Promise<SuggestedCommitPreferences> => {
  const response = await authenticatedFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not save suggested commit settings.'));
  return response.json();
};
