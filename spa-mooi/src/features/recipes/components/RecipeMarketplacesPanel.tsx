import { useState } from 'react';
import { ChefHat, Plus } from 'lucide-react';
import { AddRecipeMarketplaceDialog } from '@/features/recipes/components/AddRecipeMarketplaceDialog';
import { RecipeMarketplaceRow } from '@/features/recipes/components/RecipeMarketplaceRow';
import { RecipesDialog } from '@/features/recipes/components/RecipesDialog';
import { useRecipeMarketplaces } from '@/features/recipes/hooks/useRecipeMarketplaces';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import { Button } from '@/shared/components/actions/Button';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { Alert } from '@/shared/components/feedback/Alert';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';

/** The account's recipe marketplaces: link, browse and remove the repositories sessions apply recipes from. */
export const RecipeMarketplacesPanel = () => {
  const { marketplaces, status, error, busy, actionError, add, remove, reload, clearActionError } = useRecipeMarketplaces();
  const [adding, setAdding] = useState(false);
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RecipeMarketplace | null>(null);

  const addButton = (
    <Button variant="tinted" size="sm" icon={Plus} disabled={busy} onClick={() => { clearActionError(); setAdding(true); }}>
      Add marketplace
    </Button>
  );

  let content;
  if (status === 'error' && marketplaces.length === 0) {
    content = <ErrorState title="Marketplaces are unavailable" description={error ?? 'They could not be loaded.'} onRetry={reload} />;
  } else if (status === 'loading' && marketplaces.length === 0) {
    content = (
      <ListGroup title="Marketplaces">
        {[0, 1].map((index) => (
          <li key={index} className="flex min-h-16 items-center gap-3 bg-surface px-4 py-2.5">
            <Skeleton className="size-10 rounded-control" />
            <span className="flex min-w-0 flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></span>
          </li>
        ))}
      </ListGroup>
    );
  } else if (marketplaces.length === 0) {
    content = (
      <EmptyState icon={ChefHat} title="No marketplaces yet"
        description="Link a GitHub repository of Markdown recipes to apply them from any session.">
        {addButton}
      </EmptyState>
    );
  } else {
    content = (
      <ListGroup title="Marketplaces" action={addButton} footer="Sessions offer the recipes of every marketplace listed here.">
        {marketplaces.map((marketplace) => (
          <RecipeMarketplaceRow key={marketplace.id} marketplace={marketplace} busy={busy}
            onBrowse={setBrowsing} onRemove={(entry) => { clearActionError(); setRemoving(entry); }} />
        ))}
      </ListGroup>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {actionError && !adding && !removing ? <Alert tone="danger">{actionError}</Alert> : null}
      {content}

      {adding ? <AddRecipeMarketplaceDialog busy={busy} actionError={actionError} onClose={() => setAdding(false)} onAdd={add} /> : null}
      {browsing ? <RecipesDialog initialMarketplaceId={browsing} onClose={() => setBrowsing(null)} /> : null}

      <ConfirmDialog open={removing !== null} onClose={() => setRemoving(null)} tone="danger" busy={busy}
        title="Remove marketplace?" confirmLabel="Remove" error={removing ? actionError : null}
        description={`Sessions stop offering the recipes of ${removing?.fullName ?? 'this repository'}. Nothing changes on GitHub, and you can link it again at any time.`}
        onConfirm={() => { if (removing) void remove(removing.id).then((removed) => { if (removed) setRemoving(null); }); }} />
    </div>
  );
};
