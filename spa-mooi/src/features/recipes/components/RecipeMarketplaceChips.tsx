import { FolderGit2, Lock } from 'lucide-react';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import { cn } from '@/shared/utils/cn';

interface RecipeMarketplaceChipsProps {
  marketplaces: RecipeMarketplace[];
  value: string | null;
  onChange: (id: string) => void;
}

/** One chip per marketplace, scrolling sideways past what fits. Rendered only when there is a choice to make. */
export const RecipeMarketplaceChips = ({ marketplaces, value, onChange }: RecipeMarketplaceChipsProps) => (
  <div role="group" aria-label="Recipe marketplace" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
    {marketplaces.map((marketplace) => {
      const active = marketplace.id === value;
      return (
        <button
          key={marketplace.id}
          type="button"
          aria-pressed={active}
          title={marketplace.description ?? marketplace.fullName}
          onClick={() => onChange(marketplace.id)}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            active ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink',
          )}
        >
          <FolderGit2 className={cn('size-4', active ? 'text-brand' : 'text-ink-subtle')} aria-hidden="true" />
          <span className="max-w-[16rem] truncate">{marketplace.fullName}</span>
          {marketplace.isPrivate ? <Lock className="size-3 text-ink-subtle" aria-label="Private" /> : null}
        </button>
      );
    })}
  </div>
);
