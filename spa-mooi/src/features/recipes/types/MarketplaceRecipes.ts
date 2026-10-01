import type { Recipe } from '@/features/recipes/types/Recipe';
import type { RecipesStatus } from '@/features/recipes/types/RecipesStatus';

/** The cached recipes of one marketplace. Kept while revalidating, so a reopened picker is instant. */
export interface MarketplaceRecipes {
  recipes: Recipe[];
  status: RecipesStatus;
  error: string | null;
}
