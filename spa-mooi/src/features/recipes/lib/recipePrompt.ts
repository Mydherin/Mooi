import type { Recipe } from '@/features/recipes/types/Recipe';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';

/**
 * The message that applies a recipe: what to do with it, then the recipe itself, verbatim. Written
 * to be safe to send twice — a recipe already in place is reviewed and completed, never duplicated.
 */
export const recipePrompt = (recipe: Recipe, marketplace: RecipeMarketplace, notes: string): string => {
  const extra = notes.trim();
  return [
    `Apply the recipe "${recipe.name}" from the ${marketplace.fullName} recipe marketplace to this project.`,
    [
      '- Adapt it to this codebase: follow its stack, structure and conventions, and map any technology-specific detail to its equivalent here.',
      '- If it is already applied, fully or partly, review the current implementation against the recipe and fix only what differs. Never duplicate it.',
      '- When done, summarize what changed.',
    ].join('\n'),
    extra ? `Additional instructions:\n${extra}` : null,
    `<recipe name="${recipe.name}" source="${marketplace.fullName}/${recipe.path}">\n${recipe.content}\n</recipe>`,
  ].filter(Boolean).join('\n\n');
};
