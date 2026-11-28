import { memo, useState } from 'react';
import { BookOpen, ExternalLink, FolderGit2, Trash2 } from 'lucide-react';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import { Badge } from '@/shared/components/data-display/Badge';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { useLongPress } from '@/shared/gestures/useLongPress';
import { formatDate } from '@/shared/utils/formatDate';

interface RecipeMarketplaceRowProps {
  marketplace: RecipeMarketplace;
  busy: boolean;
  onBrowse: (id: string) => void;
  onRemove: (marketplace: RecipeMarketplace) => void;
}

/** One linked marketplace: tapping it browses its recipes; the rest lives in its menu (also on long press). */
export const RecipeMarketplaceRow = memo(({ marketplace, busy, onBrowse, onRemove }: RecipeMarketplaceRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const press = useLongPress(() => setMenuOpen(true));

  return (
    <li className="flex min-h-16 min-w-0 items-center gap-1 bg-surface pr-2">
      <button type="button" {...press} onClick={() => onBrowse(marketplace.id)}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left outline-none active:bg-surface-2 focus-visible:bg-surface-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-muted">
          <FolderGit2 aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <TruncatedText text={marketplace.fullName} className="min-w-0 text-body font-medium text-ink" />
            <Badge tone={marketplace.isPrivate ? 'warning' : 'neutral'} className="shrink-0">{marketplace.isPrivate ? 'Private' : 'Public'}</Badge>
          </span>
          {marketplace.description ? <TruncatedText text={marketplace.description} lines={2} className="mt-0.5 text-footnote text-ink-muted" /> : null}
          <span className="mt-0.5 block text-footnote text-ink-subtle">Added {formatDate(marketplace.addedAt)}</span>
        </span>
      </button>
      <Menu label={`${marketplace.fullName} actions`} open={menuOpen} onOpenChange={setMenuOpen} sections={[
        { id: 'main', items: [
          { id: 'browse', label: 'Browse recipes', icon: BookOpen, onSelect: () => onBrowse(marketplace.id) },
          { id: 'github', label: 'Open on GitHub', icon: ExternalLink, href: marketplace.htmlUrl ?? undefined, hidden: !marketplace.htmlUrl },
        ] },
        { id: 'danger', items: [{ id: 'remove', label: 'Remove marketplace', icon: Trash2, destructive: true, disabled: busy, onSelect: () => onRemove(marketplace) }] },
      ]} />
    </li>
  );
});

RecipeMarketplaceRow.displayName = 'RecipeMarketplaceRow';
