import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';

interface ProjectsHeaderProps {
  onAdd: () => void;
  onRefresh: () => void;
  busy: boolean;
  canAdd: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  showSearch: boolean;
}

export const ProjectsHeader = ({
  onAdd,
  onRefresh,
  busy,
  canAdd,
  query,
  onQueryChange,
  showSearch,
}: ProjectsHeaderProps) => (
  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <h1 className="text-[32px] font-extrabold tracking-[-0.045em] text-ink sm:text-[38px]">
        Your workspace
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        References to repositories you own. Mooi stores no code — only what it needs to recognise
        them.
      </p>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {showSearch ? (
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Search projects"
          className="sm:w-64"
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={onRefresh}
          disabled={busy}
          className="flex-1 sm:flex-none"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
        <Button
          variant="brand"
          size="md"
          onClick={onAdd}
          disabled={!canAdd}
          className="flex-1 sm:flex-none"
        >
          <Plus className="size-4" />
          Add repository
        </Button>
      </div>
    </div>
  </div>
);
