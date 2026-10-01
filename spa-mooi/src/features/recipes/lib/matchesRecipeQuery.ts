import type { Recipe } from '@/features/recipes/types/Recipe';

export const matchesRecipeQuery = (recipe: Recipe, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [recipe.name, recipe.slug, recipe.description ?? ''].some((field) => field.toLowerCase().includes(needle));
};
