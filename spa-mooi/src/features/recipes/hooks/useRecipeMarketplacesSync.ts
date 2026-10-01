import { useEffect } from 'react';
import { fetchRecipeMarketplaces } from '@/features/recipes/api/recipeMarketplacesApi';
import { useRecipesStore } from '@/stores/recipesStore';

/**
 * Loads the linked recipe marketplaces once, for the whole application shell: whether any exists
 * decides if a session offers recipes at all, so it must be known before a chat opens.
 */
export const useRecipeMarketplacesSync = (): void => {
  useEffect(() => {
    let cancelled = false;

    useRecipesStore.getState().setStatus('loading');
    fetchRecipeMarketplaces()
      .then((marketplaces) => {
        if (!cancelled) useRecipesStore.getState().setMarketplaces(marketplaces);
      })
      .catch((failure: Error) => {
        if (!cancelled) useRecipesStore.getState().setError(failure.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);
};
