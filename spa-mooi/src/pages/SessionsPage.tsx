import { useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { MessagesSquare, Plus, RefreshCw, Search } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useLiveStatus } from '@/features/live/hooks/useLiveStatus';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { SessionGroupSection } from '@/features/sessions/components/overview/SessionGroupSection';
import { SessionsOverviewStats } from '@/features/sessions/components/overview/SessionsOverviewStats';
import { StartSessionDialog } from '@/features/sessions/components/overview/StartSessionDialog';
import { groupSessionsByProject } from '@/features/sessions/lib/groupSessionsByProject';
import { matchesSessionQuery } from '@/features/sessions/lib/matchesSessionQuery';
import { SESSION_FILTERS, sessionFilter } from '@/features/sessions/lib/sessionFilters';
import { Button } from '@/shared/components/actions/Button';
import type { ActionItem } from '@/shared/components/actions/ActionItem';
import { ResponsiveActions } from '@/shared/components/actions/ResponsiveActions';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { SearchInput } from '@/shared/components/forms/SearchInput';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Tabs } from '@/shared/components/navigation/Tabs';
import type { BackLink } from '@/shared/types/BackLink';
import { useSessionsStore } from '@/stores/sessionsStore';

const FILTER_PARAM = 'filter';

const SessionsSkeleton = () => (
  <div aria-busy className="flex flex-col gap-6">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-22 rounded-card" />)}
    </div>
    <Skeleton className="h-56 rounded-card" />
  </div>
);

/**
 * Every live session of the player in one place, grouped by project, so checking on agents does
 * not mean opening each project. The list stays live through the player's channel; the active filter
 * lives in `?filter=` so a reload lands back on the same view.
 */
export const SessionsPage = () => {
  const { projects } = useProjects();
  const allSessions = useSessionsStore((state) => state.sessions);
  const sessions = useMemo(() => allSessions.filter((session) => session.kind === 'session'), [allSessions]);
  const { loading, error, reconnect: reload } = useLiveStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const { search } = useLocation();
  const backLink: BackLink = useMemo(() => ({ to: `${ROUTES.sessions}${search}`, label: 'Sessions' }), [search]);
  const filter = sessionFilter(searchParams.get(FILTER_PARAM));

  const searched = useMemo(() => sessions.filter((session) => matchesSessionQuery(session, query)), [sessions, query]);
  const groups = useMemo(
    () => groupSessionsByProject(searched.filter(filter.matches), projects),
    [searched, filter, projects],
  );

  const handleFilterChange = (next: string) =>
    setSearchParams(next === SESSION_FILTERS[0].id ? {} : { [FILTER_PARAM]: next }, { replace: true });

  const showAll = () => {
    setQuery('');
    handleFilterChange(SESSION_FILTERS[0].id);
  };

  const firstLoad = loading && sessions.length === 0;

  const actions: ActionItem[] = [
    { id: 'new', label: 'New session', icon: Plus, primary: true, variant: 'brand', onSelect: () => setNewSessionOpen(true) },
    { id: 'refresh', label: 'Refresh', icon: RefreshCw, loading, disabled: loading, onSelect: reload },
  ];

  return (
    <Page width="wide">
      <PageHeader title="Sessions" eyebrow="Development" actions={<ResponsiveActions actions={actions} />}
        subtitle="Every live session across your projects, kept up to date while agents work and apps deploy.">
        {sessions.length > 0 ? <SearchInput value={query} onChange={setQuery} placeholder="Search branch, project or agent" className="sm:max-w-xs" /> : null}
      </PageHeader>

      <PageSection className="flex flex-col gap-6">
        {error ? <ErrorState description={error} onRetry={reload} retrying={loading} /> : null}

        {firstLoad ? <SessionsSkeleton /> : null}

        {!firstLoad && sessions.length === 0 && !error ? (
          <EmptyState icon={MessagesSquare} title="No live sessions"
            description="Start a session to have an agent work on one of your projects. It shows up here while it runs." />
        ) : null}

        {sessions.length > 0 ? (
          <>
            <SessionsOverviewStats sessions={sessions} />

            <Tabs
              ariaLabel="Session filters"
              value={filter.id}
              onChange={handleFilterChange}
              className="-mb-2 border-b border-line"
              items={SESSION_FILTERS.map(({ id, label, icon, matches }) => ({
                id, label, icon, count: searched.filter(matches).length,
              }))}
            />

            {groups.length > 0 ? (
              <div className="flex flex-col gap-8">
                {groups.map((group) => <SessionGroupSection key={group.projectId} group={group} backLink={backLink} />)}
              </div>
            ) : (
              <EmptyState icon={Search} title="No sessions match" description="Try another search or filter.">
                <Button variant="ghost" onClick={showAll}>Show all sessions</Button>
              </EmptyState>
            )}
          </>
        ) : null}

      </PageSection>

      <StartSessionDialog open={newSessionOpen} initialProjectId={sessions[0]?.projectId ?? projects[0]?.id ?? null}
        backLink={backLink} onClose={() => setNewSessionOpen(false)} />
    </Page>
  );
};
