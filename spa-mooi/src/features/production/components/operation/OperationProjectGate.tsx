import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import type { Project } from '@/features/projects/types/Project';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { BackButton } from '@/shared/components/navigation/BackButton';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import type { BackLink } from '@/shared/types/BackLink';
import { useProjectsStore } from '@/stores/projectsStore';

interface OperationProjectGateProps {
  projectId: string | undefined;
  back: BackLink;
  children: (project: Project) => ReactNode;
}

/**
 * Resolves the project of a production or backup screen: its skeleton while the workspace loads,
 * a way back when the project is not part of it, and the screen itself once it is known.
 */
export const OperationProjectGate = ({ projectId, back, children }: OperationProjectGateProps) => {
  const project = useProjectsStore((state) => state.projects.find((item) => item.id === projectId));
  const loading = useProjectsStore((state) => state.status === 'idle' || state.status === 'loading');

  if (project) return children(project);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-gutter">
        <BackButton back={back} compact={loading} />
        {loading ? <Skeleton className="h-5 w-40" /> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-gutter">
        {loading ? <div aria-busy className="mx-auto flex max-w-6xl flex-col gap-4">
          <Skeleton className="h-44 rounded-panel" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-22 rounded-card" />)}</div>
        </div> : <EmptyState icon={Compass} title="Project not found" description="This project is not part of your workspace, or it was removed.">
          <Link to={back.to} className={buttonStyles('secondary', 'md')}>Back to {back.label}</Link>
        </EmptyState>}
      </div>
    </div>
  );
};
