import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { cn } from '@/shared/utils/cn';

interface SessionsOverviewHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  showSearch: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

export const SessionsOverviewHeader = ({ query, onQueryChange, showSearch, refreshing, onRefresh }: SessionsOverviewHeaderProps) => (
  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <h1 className="text-[32px] font-extrabold tracking-[-0.045em] text-ink sm:text-[38px]">Sessions</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Every live session across your projects, kept up to date while agents work and apps deploy.
      </p>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {showSearch ? (
        <SearchInput value={query} onChange={onQueryChange} placeholder="Search branch, project or agent" className="sm:w-72" />
      ) : null}
      <Button variant="secondary" size="md" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  </div>
);
