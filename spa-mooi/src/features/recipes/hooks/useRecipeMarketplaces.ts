import { useCallback, useState } from 'react';
import {
  addRecipeMarketplace,
  fetchRecipeMarketplaces,
  removeRecipeMarketplace,
} from '@/features/recipes/api/recipeMarketplacesApi';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import type { RecipesStatus } from '@/features/recipes/types/RecipesStatus';
import { useRecipesStore } from '@/stores/recipesStore';

interface UseRecipeMarketplaces {
  marketplaces: RecipeMarketplace[];
  status: RecipesStatus;
  error: string | null;
  busy: boolean;
  actionError: string | null;
  add: (url: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  reload: () => void;
  clearActionError: () => void;
}

/**
 * The linked marketplaces plus the actions that change them. Actions carry their own
 * `busy`/`actionError` (same reasoning as `useAgentConnections`): a failed link must not blank out
 * the marketplaces already on screen.
 */
export const useRecipeMarketplaces = (): UseRecipeMarketplaces => {
  const marketplaces = useRecipesStore((state) => state.marketplaces);
  const status = useRecipesStore((state) => state.status);
  const error = useRecipesStore((state) => state.error);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (failure) {
      setActionError((failure as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const add = useCallback((url: string) => run(async () => {
    useRecipesStore.getState().upsertMarketplace(await addRecipeMarketplace(url));
  }), [run]);

  const remove = useCallback((id: string) => run(async () => {
    await removeRecipeMarketplace(id);
    useRecipesStore.getState().removeMarketplace(id);
  }), [run]);

  const reload = useCallback(() => {
    useRecipesStore.getState().setStatus('loading');
    fetchRecipeMarketplaces()
      .then((loaded) => useRecipesStore.getState().setMarketplaces(loaded))
      .catch((failure: Error) => useRecipesStore.getState().setError(failure.message));
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  return { marketplaces, status, error, busy, actionError, add, remove, reload, clearActionError };
};
