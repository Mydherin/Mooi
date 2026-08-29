import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/Button';

interface ProjectsHeaderProps {
  onAdd: () => void;
  onRefresh: () => void;
  busy: boolean;
  canAdd: boolean;
}

export const ProjectsHeader = ({ onAdd, onRefresh, busy, canAdd }: ProjectsHeaderProps) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Projects</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        GitHub repositories you have added to your workspace.
      </p>
    </div>

    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onRefresh}
        disabled={busy}
        className="flex-1 sm:flex-none"
      >
        <RefreshCw className="size-4" />
        Refresh
      </Button>
      <Button
        variant="brand"
        size="sm"
        onClick={onAdd}
        disabled={!canAdd}
        className="flex-1 sm:flex-none"
      >
        <Plus className="size-4" />
        Add repository
      </Button>
    </div>
  </div>
);
