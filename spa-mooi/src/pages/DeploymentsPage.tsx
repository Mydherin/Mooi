import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderGit2, History, Rocket, SearchX } from 'lucide-react';
import { deploymentPath } from '@/app/paths';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { deleteProductionDeployment } from '@/features/production/api/productionApi';
import { ProductionDeploymentDetailDialog } from '@/features/production/components/ProductionDeploymentDetailDialog';
import { ProductionHistoryList } from '@/features/production/components/ProductionHistoryList';
import { ProductionProjectCard } from '@/features/production/components/ProductionProjectCard';
import { useProductionDeployments } from '@/features/production/hooks/useProductionDeployments';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import { Button } from '@/shared/components/actions/Button';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { SearchInput } from '@/shared/components/forms/SearchInput';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { useTabParam } from '@/shared/components/navigation/useTabParam';

const VIEWS = ['projects', 'history'] as const;

/**
 * Production across the workspace: pick a project to open its deployment view, or review every
 * recorded release. Nothing is started from here; a project's view owns its whole lifecycle.
 */
export const DeploymentsPage = () => {
  const navigate = useNavigate();
  const { projects, status, error: projectsError, reload: reloadProjects } = useProjects();
  const history = useProductionDeployments(true);
  const [view, setView] = useTabParam(VIEWS, 'projects');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ProductionDeployment | null>(null);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const latestByProject = useMemo(() => {
    const latest = new Map<string, ProductionDeployment>();
    history.deployments.forEach((deployment) => { if (!latest.has(deployment.projectId)) latest.set(deployment.projectId, deployment); });
    return latest;
  }, [history.deployments]);
  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects
      .filter((project) => !term || project.fullName.toLowerCase().includes(term))
      .sort((a, b) => (latestByProject.get(b.id)?.startedAt ?? '').localeCompare(latestByProject.get(a.id)?.startedAt ?? ''));
  }, [projects, query, latestByProject]);
  const live = useMemo(() => [...latestByProject.values()].filter((deployment) => deployment.state === 'succeeded').length, [latestByProject]);
  const loadingProjects = (status === 'loading' || status === 'idle') && projects.length === 0;

  return (
    <Page>
      <PageHeader title="Deployments" eyebrow="Production"
        subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} · ${live} live`}>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <SegmentedControl ariaLabel="Deployment views" value={view} onChange={(next) => setView(next as typeof VIEWS[number])} className="sm:w-64"
            items={[{ id: 'projects', label: 'Projects', icon: FolderGit2 }, { id: 'history', label: 'History', icon: History }]} />
          {view === 'projects' && projects.length > 6 ? <SearchInput value={query} onChange={setQuery} placeholder="Search projects" className="min-w-0 sm:max-w-xs" /> : null}
        </div>
      </PageHeader>

      {view === 'projects' ? <section aria-label="Projects" className="flex flex-col gap-4">
        {projectsError ? <ErrorState description={projectsError} onRetry={reloadProjects} />
          : loadingProjects ? <div aria-busy className="flex flex-col gap-px overflow-hidden rounded-card">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 rounded-none" />)}</div>
            : projects.length === 0 ? <EmptyState icon={FolderGit2} title="No projects yet" description="Add a project to your workspace to deploy it to production." />
              : visibleProjects.length === 0 ? <EmptyState icon={SearchX} title="No matches" description={`No project matches “${query}”.`} />
                : <ListGroup>{visibleProjects.map((project) => <ProductionProjectCard key={project.id} project={project} latest={latestByProject.get(project.id)} />)}</ListGroup>}
      </section> : <section aria-label="History" className="flex flex-col gap-4">
        {history.error && history.deployments.length === 0 ? <ErrorState description={history.error} onRetry={history.reload} />
          : history.loading && history.deployments.length === 0 ? <Skeleton className="h-48 rounded-card" />
            : history.deployments.length === 0 ? <EmptyState icon={Rocket} title="No deployments yet"
              description="Every production release appears here with its outcome, files and output." />
              : <ProductionHistoryList deployments={history.deployments} projects={projectById} onOpen={setSelected} />}
        {history.hasMore ? <Button variant="secondary" loading={history.loading} onClick={() => void history.loadMore()} className="self-center">Load more</Button> : null}
      </section>}

      {selected ? <ProductionDeploymentDetailDialog key={selected.operationId} deployment={selected}
        projectName={projectById.get(selected.projectId)?.name ?? 'Removed project'} onClose={() => setSelected(null)}
        projectTo={projectById.has(selected.projectId) ? deploymentPath(selected.projectId) : undefined}
        onFix={projectById.has(selected.projectId) ? () => navigate(deploymentPath(selected.projectId)) : undefined}
        onDelete={async () => {
          await deleteProductionDeployment(selected.projectId, selected.operationId);
          history.remove(selected.operationId);
          setSelected(null);
        }} /> : null}
    </Page>
  );
};
