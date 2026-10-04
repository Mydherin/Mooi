import { useState } from 'react';
import { ChefHat } from 'lucide-react';
import { RecipesDialog } from '@/features/recipes/components/RecipesDialog';
import { useRecipesStore } from '@/stores/recipesStore';

interface RecipesButtonProps {
  disabled: boolean;
  onApply: (prompt: string) => Promise<boolean>;
}

/** The composer's door to recipes. Absent until the player links a marketplace: nothing to offer, nothing shown. */
export const RecipesButton = ({ disabled, onApply }: RecipesButtonProps) => {
  const available = useRecipesStore((state) => state.marketplaces.length > 0);
  const [open, setOpen] = useState(false);

  if (!available) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Apply a recipe" title="Apply a recipe" aria-haspopup="dialog"
        className="flex size-8 shrink-0 items-center justify-center rounded-full sm:size-9 text-amber-500 transition hover:bg-amber-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <ChefHat className="size-4" aria-hidden="true" />
      </button>
      {open ? <RecipesDialog onClose={() => setOpen(false)} onApply={onApply} applyDisabled={disabled} /> : null}
    </>
  );
};
