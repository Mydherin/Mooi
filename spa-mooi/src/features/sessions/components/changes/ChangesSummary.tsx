import { GitMerge } from 'lucide-react';
import { changedFilesSummary } from '@/features/sessions/data/changedFiles';
import { Button } from '@/shared/components/Button';

export const ChangesSummary = () => (
  <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
    <span className="text-sm font-medium text-ink">{changedFilesSummary.files} files changed</span>
    <span className="font-mono text-xs text-success">+{changedFilesSummary.added}</span>
    <span className="font-mono text-xs text-danger">−{changedFilesSummary.removed}</span>

    <Button variant="secondary" size="sm" className="ml-auto hidden sm:inline-flex">
      <GitMerge className="size-4" />
      Merge to main
    </Button>
  </div>
);
