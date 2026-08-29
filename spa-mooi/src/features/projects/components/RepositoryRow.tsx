import { Globe, Lock, Plus, Star } from 'lucide-react';
import type { GithubRepository } from '@/features/github/types/GithubRepository';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { formatDate } from '@/shared/utils/formatDate';

interface RepositoryRowProps {
  repository: GithubRepository;
  added: boolean;
  busy: boolean;
  onAdd: () => void;
}

export const RepositoryRow = ({ repository, added, busy, onAdd }: RepositoryRowProps) => {
  const VisibilityIcon = repository.isPrivate ? Lock : Globe;

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-subtle">
        <VisibilityIcon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-ink">{repository.fullName}</p>

        {repository.description ? (
          <p className="mt-0.5 truncate text-xs text-ink-muted">{repository.description}</p>
        ) : null}

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
          {repository.language ? <span>{repository.language}</span> : null}
          <span className="flex items-center gap-1">
            <Star className="size-3.5" />
            {repository.stars}
          </span>
          {repository.pushedAt ? <span>Updated {formatDate(repository.pushedAt)}</span> : null}
        </p>
      </div>

      <span className="shrink-0">
        {added ? (
          <Badge tone="success">Added</Badge>
        ) : (
          <Button variant="brand" size="sm" onClick={onAdd} disabled={busy}>
            <Plus className="size-4" />
            Add
          </Button>
        )}
      </span>
    </li>
  );
};
