import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ProjectFilters } from '@/features/projects/components/ProjectFilters';
import { ProjectGrid } from '@/features/projects/components/ProjectGrid';
import { ProjectsHeader } from '@/features/projects/components/ProjectsHeader';
import { projects } from '@/features/projects/data/projects';
import type { ProjectFilterId } from '@/features/projects/types/ProjectFilterId';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';

export const ProjectsPage = () => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectFilterId>('all');

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesFilter = filter === 'all' || project.status === filter;
      const matchesQuery =
        needle.length === 0 ||
        project.name.toLowerCase().includes(needle) ||
        project.repo.toLowerCase().includes(needle) ||
        project.description.toLowerCase().includes(needle);

      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  const clearFilters = () => {
    setQuery('');
    setFilter('all');
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <ProjectsHeader />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search projects"
          className="sm:max-w-xs"
        />
        <ProjectFilters value={filter} onChange={setFilter} />
      </div>

      <div className="mt-6">
        {visibleProjects.length > 0 ? (
          <ProjectGrid projects={visibleProjects} />
        ) : (
          <EmptyState
            icon={Search}
            title="No projects match"
            description="Try another search or clear the filters."
          >
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          </EmptyState>
        )}
      </div>
    </div>
  );
};
