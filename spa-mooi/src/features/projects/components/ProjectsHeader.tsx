import { FolderInput, FolderPlus, RefreshCw } from 'lucide-react';
import { SearchInput } from '@/shared/components/SearchInput';
import { iconAction } from '@/shared/styles/iconAction';
import { cn } from '@/shared/utils/cn';

interface ProjectsHeaderProps {
  onAdd: () => void;
  onCreate: () => void;
  onRefresh: () => void;
  busy: boolean;
  canAdd: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  showSearch: boolean;
}

export const ProjectsHeader = ({
  onAdd,
  onCreate,
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
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          aria-label="Refresh projects"
          title="Refresh projects"
          className={iconAction}
        >
          <RefreshCw className={cn('size-4', busy && 'animate-spin')} />
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={!canAdd}
          aria-label="Create project"
          title="Create project"
          className={iconAction}
        >
          <FolderPlus className="size-4" />
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          aria-label="Add repository"
          title="Add repository"
          className={iconAction}
        >
          <FolderInput className="size-4" />
        </button>
      </div>
    </div>
  </div>
);
