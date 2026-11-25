import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, GitBranch, GitBranchPlus } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { SessionLiveStatus } from '@/features/sessions/components/SessionLiveStatus';
import { useLinkedSessions } from '@/features/sessions/hooks/useLinkedSessions';
import type { Session } from '@/features/sessions/types/Session';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

interface LinkedSessionsMenuProps {
  session: Session;
}

const Heading = ({ children }: { children: ReactNode }) => (
  <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.06em] text-ink-subtle uppercase">{children}</p>
);

const rowClassName = 'flex min-h-12 w-full items-center gap-3 rounded-chip px-2.5 py-2 text-left transition-colors duration-150';

const RowText = ({ title, branch }: { title: string | null | undefined; branch: string }) => (
  <span className="min-w-0 flex-1">
    {title ? <span className="block truncate text-[13px] font-semibold text-ink">{title}</span> : null}
    <span className={title ? 'mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-ink-subtle'
      : 'flex min-w-0 items-center gap-1 text-[13px] font-semibold text-ink'}>
      <GitBranch aria-hidden className="size-3 shrink-0 text-ink-subtle" />
      <span className="truncate font-mono">{branch}</span>
    </span>
  </span>
);

const LinkedRow = ({ session, onNavigate }: { session: Session; onNavigate: () => void }) => (
  <Link role="menuitem" to={sessionPath(session.projectId, session.id)} onClick={onNavigate}
    className={`${rowClassName} hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand`}>
    <RowText title={session.title} branch={session.branch} />
    <SessionLiveStatus session={session} />
    <ChevronRight aria-hidden className="size-3.5 shrink-0 text-line-strong" />
  </Link>
);

/**
 * A session's lineage, one tap from its header: the session whose agent opened it and the ones its
 * own agent opened, each with its live state. Only sessions with a lineage show it.
 */
export const LinkedSessionsMenu = ({ session }: LinkedSessionsMenuProps) => {
  const { origin, opened } = useLinkedSessions(session);
  if (!session.origin && opened.length === 0) return null;
  const count = opened.length + (session.origin ? 1 : 0);

  return (
    <ActionsMenu label={`Linked sessions (${count})`} icon={GitBranchPlus} count={count}
      panelClassName="w-[min(21rem,calc(100vw-1.5rem))] max-h-[min(26rem,calc(100dvh-6rem))]">
      {(dismiss) => (
        <>
          {session.origin ? (
            <>
              <Heading>Opened from</Heading>
              {origin ? <LinkedRow session={origin} onNavigate={dismiss} /> : (
                <div className={rowClassName}>
                  <RowText title={null} branch={session.origin.branch} />
                  <SessionLiveStatus session={undefined} />
                </div>
              )}
            </>
          ) : null}
          {opened.length > 0 ? (
            <>
              <Heading>Opened by this session</Heading>
              {opened.map((child) => <LinkedRow key={child.id} session={child} onNavigate={dismiss} />)}
            </>
          ) : null}
        </>
      )}
    </ActionsMenu>
  );
};
