import { useCallback, useMemo, useState } from 'react';
import { FolderGit2, FolderInput, FolderPlus, RefreshCw, SearchX } from 'lucide-react';
import { DevelopmentEnvironmentDialog } from '@/features/development/components/DevelopmentEnvironmentDialog';
import { GithubGateCard } from '@/features/github/components/GithubGateCard';
import { useGithubLinked } from '@/features/github/hooks/useGithubLinked';
import { AddProjectDialog } from '@/features/projects/components/AddProjectDialog';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { ProjectRow } from '@/features/projects/components/ProjectRow';
import { useProjects } from '@/features/projects/hooks/useProjects';
import type { Project } from '@/features/projects/types/Project';
import { Button } from '@/shared/components/actions/Button';
import { ResponsiveActions } from '@/shared/components/actions/ResponsiveActions';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { Alert } from '@/shared/components/feedback/Alert';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { SearchInput } from '@/shared/components/forms/SearchInput';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';

type Overlay = { kind: 'add' } | { kind: 'create' } | { kind: 'edit' | 'environment'; project: Project } | null;

/**
 * The home of a signed-in user: the workspace is its projects, so there is nothing in front of them.
 * It starts empty until the user creates or imports a GitHub repository.
 */
export const ProjectsPage = () => {
  const { linked, resolved } = useGithubLinked();
  const { projects, status, error, reload, refreshing, refresh, actionError } = useProjects();
  const [query, setQuery] = useState('');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const close = useCallback(() => setOverlay(null), []);
  const edit = useCallback((project: Project) => setOverlay({ kind: 'edit', project }), []);
  const environment = useCallback((project: Project) => setOverlay({ kind: 'environment', project }), []);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => project.fullName.toLowerCase().includes(needle)
      || (project.description ?? '').toLowerCase().includes(needle));
  }, [projects, query]);

  if (resolved && !linked) {
    return <Page>
      <PageHeader title="Projects" />
      <GithubGateCard title="Connect GitHub to add projects"
        description="Mooi builds on your repositories. Link your GitHub account and import the ones you want to work on." />
    </Page>;
  }

  const loading = (status === 'loading' || status === 'idle') && projects.length === 0;
  const empty = status === 'ready' && projects.length === 0;

  return (
    <Page>
      <PageHeader title="Projects"
        subtitle={projects.length > 0 ? `${projects.length} ${projects.length === 1 ? 'repository' : 'repositories'}` : undefined}
        actions={empty ? undefined : <ResponsiveActions label="More project actions" actions={[
          { id: 'create', label: 'New project', icon: FolderPlus, primary: true, variant: 'brand', disabled: !linked, onSelect: () => setOverlay({ kind: 'create' }) },
          { id: 'add', label: 'Add repository', icon: FolderInput, disabled: !linked, onSelect: () => setOverlay({ kind: 'add' }) },
          { id: 'refresh', label: 'Refresh from GitHub', icon: RefreshCw, loading: refreshing, disabled: refreshing || status === 'loading', onSelect: () => void refresh() },
        ]} />}>
        {projects.length > 0 ? <SearchInput value={query} onChange={setQuery} placeholder="Search projects" className="min-w-0 sm:max-w-xs" /> : null}
      </PageHeader>

      <PageSection className="flex flex-col gap-4">
        {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
        {status === 'error' ? <ErrorState description={error ?? 'The projects could not be loaded.'} onRetry={reload} />
          : loading ? <div aria-busy className="flex flex-col gap-px overflow-hidden rounded-card">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 rounded-none" />)}</div>
            : empty ? <EmptyState icon={FolderGit2} title="No projects yet" description="Create a GitHub repository or add one you already have to start working on it here.">
              <Button variant="brand" icon={FolderPlus} onClick={() => setOverlay({ kind: 'create' })}>New project</Button>
              <Button variant="secondary" icon={FolderInput} onClick={() => setOverlay({ kind: 'add' })}>Add repository</Button>
            </EmptyState>
              : visibleProjects.length === 0 ? <EmptyState icon={SearchX} title="No projects match" description={`No project matches “${query}”.`}>
                <Button variant="ghost" onClick={() => setQuery('')}>Clear search</Button>
              </EmptyState>
                : <ListGroup>{visibleProjects.map((project) => <ProjectRow key={project.id} project={project} onEdit={edit} onEnvironment={environment} />)}</ListGroup>}
      </PageSection>

      <AddProjectDialog open={overlay?.kind === 'add'} onClose={close} />
      <CreateProjectDialog open={overlay?.kind === 'create'} onClose={close} />
      {overlay?.kind === 'edit' ? <EditProjectDialog key={overlay.project.id} project={overlay.project} onClose={close} /> : null}
      {overlay?.kind === 'environment' ? <DevelopmentEnvironmentDialog key={overlay.project.id} projectId={overlay.project.id} onClose={close} /> : null}
    </Page>
  );
};
