import { BookOpen, FolderGit2, Trash2 } from 'lucide-react';
import type { RecipeMarketplace } from '@/features/recipes/types/RecipeMarketplace';
import { Badge } from '@/shared/components/Badge';
import { GithubMark } from '@/shared/components/icons/GithubMark';
import { iconAction } from '@/shared/styles/iconAction';
import { cn } from '@/shared/utils/cn';
import { formatDate } from '@/shared/utils/formatDate';

interface RecipeMarketplaceRowProps {
  marketplace: RecipeMarketplace;
  busy: boolean;
  onBrowse: () => void;
  onRemove: () => void;
}

export const RecipeMarketplaceRow = ({ marketplace, busy, onBrowse, onRemove }: RecipeMarketplaceRowProps) => (
  <li className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted"><FolderGit2 className="size-5" /></span>
    <div className="min-w-0 flex-1">
      <p className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold text-ink">{marketplace.fullName}</span>
        <Badge tone={marketplace.isPrivate ? 'warning' : 'neutral'}>{marketplace.isPrivate ? 'Private' : 'Public'}</Badge>
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-subtle">
        {marketplace.description ? `${marketplace.description} · ` : ''}Added {formatDate(marketplace.addedAt)}
      </p>
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
      <button type="button" onClick={onBrowse} aria-label="Browse recipes" title="Browse recipes" className={iconAction}>
        <BookOpen className="size-4" />
      </button>
      {marketplace.htmlUrl ? (
        <a href={marketplace.htmlUrl} target="_blank" rel="noreferrer" aria-label="Open on GitHub" title="Open on GitHub" className={iconAction}>
          <GithubMark className="size-4" />
        </a>
      ) : null}
      <button type="button" onClick={onRemove} disabled={busy} aria-label="Remove marketplace" title="Remove marketplace"
        className={cn(iconAction, 'border-danger/35 text-danger hover:bg-danger-soft hover:text-danger')}>
        <Trash2 className="size-4" />
      </button>
    </div>
  </li>
);
