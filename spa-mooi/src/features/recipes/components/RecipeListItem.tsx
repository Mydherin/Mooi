import { ChefHat } from 'lucide-react';
import type { Recipe } from '@/features/recipes/types/Recipe';
import { cn } from '@/shared/utils/cn';

interface RecipeListItemProps {
  recipe: Recipe;
  selected: boolean;
  onSelect: () => void;
}

export const RecipeListItem = ({ recipe, selected, onSelect }: RecipeListItemProps) => (
  <li>
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected ? 'border-brand bg-brand/10' : 'border-transparent hover:bg-surface-2',
      )}
    >
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-contrast text-contrast-ink' : 'bg-surface-2 text-ink-muted')}>
        <ChefHat className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{recipe.name}</span>
        {recipe.description ? <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{recipe.description}</span> : null}
        <span className="mt-1 block truncate font-mono text-[11px] text-ink-subtle">{recipe.slug}</span>
      </span>
    </button>
  </li>
);
