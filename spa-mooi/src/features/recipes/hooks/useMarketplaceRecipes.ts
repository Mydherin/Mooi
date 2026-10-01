import { useCallback, useEffect } from 'react';
import { fetchMarketplaceRecipes } from '@/features/recipes/api/recipeMarketplacesApi';
import type { MarketplaceRecipes } from '@/features/recipes/types/MarketplaceRecipes';
import { useRecipesStore } from '@/stores/recipesStore';

const idle: MarketplaceRecipes = { recipes: [], status: 'idle', error: null };

/**
 * The recipes of one marketplace, stale-while-revalidate: cached recipes render at once while a
 * fresh read runs, so a reopened picker never flashes empty yet always ends up current.
 */
export const useMarketplaceRecipes = (marketplaceId: string | null): MarketplaceRecipes & { reload: () => void } => {
  const entry = useRecipesStore((state) => (marketplaceId ? state.recipes[marketplaceId] : undefined)) ?? idle;

  const reload = useCallback(() => {
    if (!marketplaceId) return;
    const { setRecipes } = useRecipesStore.getState();
    setRecipes(marketplaceId, { status: 'loading', error: null });
    fetchMarketplaceRecipes(marketplaceId)
      .then((recipes) => setRecipes(marketplaceId, { recipes, status: 'ready' }))
      .catch((failure: Error) => setRecipes(marketplaceId, { status: 'error', error: failure.message }));
  }, [marketplaceId]);

  useEffect(reload, [reload]);

  return { ...entry, reload };
};
