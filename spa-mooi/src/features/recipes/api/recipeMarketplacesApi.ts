import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { Recipe } from '@/features/recipes/types/Recipe';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import type { RecipeMarketplacesResponse } from '@/features/recipes/types/RecipeMarketplacesResponse';
import type { RecipesResponse } from '@/features/recipes/types/RecipesResponse';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const marketplacesPath = () => '/me/recipe-marketplaces';
const marketplacePath = (id: string) => `/me/recipe-marketplaces/${encodeURIComponent(id)}`;
const recipesPath = (id: string) => `${marketplacePath(id)}/recipes`;

export const fetchRecipeMarketplaces = async (): Promise<RecipeMarketplace[]> => {
  const response = await authenticatedFetch(marketplacesPath());
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not load your recipe marketplaces.'));
  return ((await response.json()) as RecipeMarketplacesResponse).marketplaces;
};

/** The API checks, with the player's own GitHub grant, that the repository is readable and has a `recipes/` folder. */
export const addRecipeMarketplace = async (url: string): Promise<RecipeMarketplace> => {
  const response = await authenticatedFetch(marketplacesPath(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not link this marketplace.'));
  return (await response.json()) as RecipeMarketplace;
};

export const removeRecipeMarketplace = async (id: string): Promise<void> => {
  const response = await authenticatedFetch(marketplacePath(id), { method: 'DELETE' });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not remove this marketplace.'));
};

/** Read live from GitHub on every call: the repository is the only source of truth for its recipes. */
export const fetchMarketplaceRecipes = async (id: string): Promise<Recipe[]> => {
  const response = await authenticatedFetch(recipesPath(id));
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not load the recipes of this marketplace.'));
  return ((await response.json()) as RecipesResponse).recipes;
};
