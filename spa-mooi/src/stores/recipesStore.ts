import { create } from 'zustand';
import type { RecipesState } from '@/stores/types/RecipesState';

const emptyRecipes = { recipes: [], status: 'idle', error: null } as const;

/**
 * Deliberately not persisted: marketplaces and their recipes are server state, read on every shell
 * mount. Recipes are cached per marketplace for the life of the tab and revalidated on each read.
 */
export const useRecipesStore = create<RecipesState>((set) => ({
  marketplaces: [],
  status: 'idle',
  error: null,
  recipes: {},
  setMarketplaces: (marketplaces) => set({ marketplaces, status: 'ready', error: null }),
  upsertMarketplace: (marketplace) =>
    set((state) => ({
      marketplaces: [marketplace, ...state.marketplaces.filter((current) => current.id !== marketplace.id)],
    })),
  removeMarketplace: (id) =>
    set((state) => {
      const recipes = { ...state.recipes };
      delete recipes[id];
      return { marketplaces: state.marketplaces.filter((marketplace) => marketplace.id !== id), recipes };
    }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),
  setRecipes: (marketplaceId, recipes) =>
    set((state) => ({
      recipes: { ...state.recipes, [marketplaceId]: { ...emptyRecipes, ...state.recipes[marketplaceId], ...recipes } },
    })),
  clear: () => set({ marketplaces: [], status: 'ready', error: null, recipes: {} }),
}));
