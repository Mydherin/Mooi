import { useMemo, useState } from 'react';
import { FolderGit2, Plus, RefreshCw, Search } from 'lucide-react';
import { GithubGateCard } from '@/features/github/components/GithubGateCard';
import { useGithubLinked } from '@/features/github/hooks/useGithubLinked';
import { AddProjectDialog } from '@/features/projects/components/AddProjectDialog';
import { ProjectGrid } from '@/features/projects/components/ProjectGrid';
import { ProjectsHeader } from '@/features/projects/components/ProjectsHeader';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';

const Skeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {[0, 1, 2].map((card) => (
      <Card key={card} className="h-[190px] animate-pulse-soft" />
    ))}
  </div>
);

/**
 * The homepage of a signed-in player: the workspace is its projects, so there is nothing to put in
 * front of them.
 *
 * It starts empty on purpose — a project exists because the player imported a repository they own,
 * so there is nothing to show until they do.
 */
export const ProjectsPage = () => {
  const { linked, resolved } = useGithubLinked();
  const { projects, status, error, reload } = useProjects();
  const [query, setQuery] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) {
      return projects;
    }

    return projects.filter(
      (project) =>
        project.fullName.toLowerCase().includes(needle) ||
        (project.description ?? '').toLowerCase().includes(needle),
    );
  }, [projects, query]);

  if (resolved && !linked) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <GithubGateCard
          title="Connect GitHub to add projects"
          description="Mooi builds on your repositories. Link your GitHub account and import the ones you want to work on."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <ProjectsHeader
        onAdd={() => setDialogOpen(true)}
        onRefresh={reload}
        busy={status === 'loading'}
        canAdd={linked}
      />

      {projects.length > 0 ? (
        <div className="mt-6">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search projects"
            className="sm:max-w-xs"
          />
        </div>
      ) : null}

      <div className="mt-6">
        {status === 'loading' && projects.length === 0 ? <Skeleton /> : null}

        {status === 'error' ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger-soft px-5 py-4 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-danger">{error}</p>
            <span className="shrink-0">
              <Button variant="secondary" size="sm" onClick={reload}>
                <RefreshCw className="size-4" />
                Try again
              </Button>
            </span>
          </div>
        ) : null}

        {status === 'ready' && projects.length === 0 ? (
          <EmptyState
            icon={FolderGit2}
            title="No projects yet"
            description="Add a GitHub repository to start working on it here."
          >
            <Button variant="brand" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Add repository
            </Button>
          </EmptyState>
        ) : null}

        {projects.length > 0 && visibleProjects.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No projects match"
            description="Try another search term."
          >
            <Button variant="ghost" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </EmptyState>
        ) : null}

        {visibleProjects.length > 0 ? <ProjectGrid projects={visibleProjects} /> : null}
      </div>

      <AddProjectDialog open={isDialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
};
