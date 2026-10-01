import type { MarketplaceRecipes } from '@/features/recipes/types/MarketplaceRecipes';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import type { RecipesStatus } from '@/features/recipes/types/RecipesStatus';

export interface RecipesState {
  marketplaces: RecipeMarketplace[];
  status: RecipesStatus;
  error: string | null;
  recipes: Record<string, MarketplaceRecipes>;
  setMarketplaces: (marketplaces: RecipeMarketplace[]) => void;
  upsertMarketplace: (marketplace: RecipeMarketplace) => void;
  removeMarketplace: (id: string) => void;
  setStatus: (status: RecipesStatus) => void;
  setError: (error: string | null) => void;
  setRecipes: (marketplaceId: string, recipes: Partial<MarketplaceRecipes>) => void;
  clear: () => void;
}
