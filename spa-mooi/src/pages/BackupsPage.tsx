import { useMemo, useState } from 'react';
import { DatabaseBackup, FolderGit2, History, SearchX } from 'lucide-react';
import { backupPath } from '@/app/paths';
import { BackupDetailDialog } from '@/features/backups/components/BackupDetailDialog';
import { BackupHistoryList } from '@/features/backups/components/BackupHistoryList';
import { BackupProjectCard } from '@/features/backups/components/BackupProjectCard';
import { useBackups } from '@/features/backups/hooks/useBackups';
import type { Backup } from '@/features/backups/types/Backup';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button } from '@/shared/components/actions/Button';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { SearchInput } from '@/shared/components/forms/SearchInput';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { useTabParam } from '@/shared/components/navigation/useTabParam';

const VIEWS = ['projects', 'history'] as const;

/**
 * Backups across the workspace: pick a project to open its backup view, or review every recorded
 * backup. Nothing runs from here; a project's view owns its whole lifecycle.
 */
export const BackupsPage = () => {
  const { projects, status, error: projectsError, reload: reloadProjects } = useProjects();
  const history = useBackups();
  const [view, setView] = useTabParam(VIEWS, 'projects');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Backup | null>(null);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const byProject = useMemo(() => {
    const grouped = new Map<string, Backup[]>();
    history.backups.forEach((backup) => grouped.set(backup.projectId, [...(grouped.get(backup.projectId) ?? []), backup]));
    return grouped;
  }, [history.backups]);
  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects
      .filter((project) => !term || project.fullName.toLowerCase().includes(term))
      .sort((a, b) => (byProject.get(b.id)?.[0]?.startedAt ?? '').localeCompare(byProject.get(a.id)?.[0]?.startedAt ?? ''));
  }, [projects, query, byProject]);
  const protectedProjects = useMemo(() => [...byProject.values()].filter((backups) => backups[0]?.state === 'succeeded').length, [byProject]);
  const loadingProjects = (status === 'loading' || status === 'idle') && projects.length === 0;

  return (
    <Page>
      <PageHeader title="Backups" eyebrow="Production"
        subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} · ${protectedProjects} protected`}>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <SegmentedControl ariaLabel="Backup views" value={view} onChange={(next) => setView(next as typeof VIEWS[number])} className="sm:w-64"
            items={[{ id: 'projects', label: 'Projects', icon: FolderGit2 }, { id: 'history', label: 'History', icon: History }]} />
          {view === 'projects' && projects.length > 6 ? <SearchInput value={query} onChange={setQuery} placeholder="Search projects" className="min-w-0 sm:max-w-xs" /> : null}
        </div>
      </PageHeader>

      {view === 'projects' ? <PageSection className="flex flex-col gap-4">
        {projectsError ? <ErrorState description={projectsError} onRetry={reloadProjects} />
          : loadingProjects ? <div aria-busy className="flex flex-col gap-px overflow-hidden rounded-card">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 rounded-none" />)}</div>
            : projects.length === 0 ? <EmptyState icon={FolderGit2} title="No projects yet" description="Add a project to your workspace to back it up." />
              : visibleProjects.length === 0 ? <EmptyState icon={SearchX} title="No matches" description={`No project matches “${query}”.`} />
                : <ListGroup>{visibleProjects.map((project) => <BackupProjectCard key={project.id} project={project}
                  latest={byProject.get(project.id)?.[0]} count={byProject.get(project.id)?.length ?? 0} />)}</ListGroup>}
      </PageSection> : <PageSection className="flex flex-col gap-4">
        {history.error && history.backups.length === 0 ? <ErrorState description={history.error} onRetry={history.reload} />
          : history.loading && history.backups.length === 0 ? <Skeleton className="h-48 rounded-card" />
            : history.backups.length === 0 ? <EmptyState icon={DatabaseBackup} title="No backups yet"
              description="Every backup appears here with its date, time, release and outcome." />
              : <BackupHistoryList backups={history.backups} projects={projectById} onOpen={setSelected} />}
        {history.hasMore ? <Button variant="secondary" loading={history.loading} onClick={history.loadMore} className="self-center">Load more</Button> : null}
      </PageSection>}

      {selected ? <BackupDetailDialog key={selected.id} backup={selected}
        projectName={projectById.get(selected.projectId)?.name ?? 'Removed project'} onClose={() => setSelected(null)}
        projectTo={projectById.has(selected.projectId) ? backupPath(selected.projectId) : undefined} /> : null}
    </Page>
  );
};
