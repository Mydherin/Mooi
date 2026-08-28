import { Link, useParams } from 'react-router-dom';
import { CloudUpload, Compass, GitBranch, MessagesSquare, Timer } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { DeploymentList } from '@/features/projects/components/DeploymentList';
import { EnvironmentCard } from '@/features/projects/components/EnvironmentCard';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { ProjectStatCard } from '@/features/projects/components/ProjectStatCard';
import { SessionList } from '@/features/projects/components/SessionList';
import { deployments } from '@/features/projects/data/deployments';
import { environments } from '@/features/projects/data/environments';
import { findProject } from '@/features/projects/lib/findProject';
import type { ProjectStat } from '@/features/projects/types/ProjectStat';
import { sessions } from '@/features/sessions/data/sessions';
import { EmptyState } from '@/shared/components/EmptyState';
import { buttonStyles } from '@/shared/styles/buttonStyles';

export const ProjectPage = () => {
  const { projectId } = useParams();
  const project = findProject(projectId);

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <EmptyState
          icon={Compass}
          title="Project not found"
          description="This project is not connected to your workspace."
        >
          <Link to={ROUTES.projects} className={buttonStyles('secondary', 'md')}>
            Back to projects
          </Link>
        </EmptyState>
      </div>
    );
  }

  const projectSessions = sessions.filter((session) => session.projectId === project.id);

  const stats: ProjectStat[] = [
    {
      id: 'sessions',
      icon: MessagesSquare,
      label: 'Sessions',
      value: String(project.sessions),
      hint: '3 active',
    },
    { id: 'deploys', icon: CloudUpload, label: 'Deploys', value: '48', hint: '5 this week' },
    { id: 'last-deploy', icon: Timer, label: 'Last deploy', value: '2h ago', hint: 'production' },
    {
      id: 'branch',
      icon: GitBranch,
      label: 'Default branch',
      value: project.branch,
      hint: 'synced 12m ago',
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <ProjectHeader project={project} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <ProjectStatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <SessionList sessions={projectSessions} />
      <DeploymentList deployments={deployments} />

      <section>
        <h2 className="text-sm font-semibold tracking-tight text-ink">Environments</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {environments.map((environment) => (
            <EnvironmentCard key={environment.id} environment={environment} />
          ))}
        </div>
      </section>
    </div>
  );
};
