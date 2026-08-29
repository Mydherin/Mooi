import { useNavigate, useParams, Link } from 'react-router-dom';
import { Clock, CloudUpload, Code, Compass, GitBranch, MessagesSquare, Star } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { ProjectStatCard } from '@/features/projects/components/ProjectStatCard';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { findProject } from '@/features/projects/lib/findProject';
import type { ProjectStat } from '@/features/projects/types/ProjectStat';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatDate } from '@/shared/utils/formatDate';

/**
 * What Mooi knows about an imported repository, and nothing it does not.
 *
 * Sessions and deployments render as empty states rather than as sample rows: a repository added a
 * minute ago has neither, and inventing them would make the screen lie about work that never ran.
 */
export const ProjectPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, status, busy, remove } = useProjects();
  const project = findProject(projects, projectId);

  if (!project) {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
          <Card className="h-40 animate-pulse-soft" />
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <EmptyState
          icon={Compass}
          title="Project not found"
          description="This project is not part of your workspace."
        >
          <Link to={ROUTES.projects} className={buttonStyles('secondary', 'md')}>
            Back to projects
          </Link>
        </EmptyState>
      </div>
    );
  }

  const stats: ProjectStat[] = [
    {
      id: 'branch',
      icon: GitBranch,
      label: 'Default branch',
      value: project.defaultBranch ?? '—',
      hint: project.fullName,
    },
    {
      id: 'stars',
      icon: Star,
      label: 'Stars',
      value: String(project.stars),
      hint: 'on GitHub',
    },
    {
      id: 'language',
      icon: Code,
      label: 'Language',
      value: project.language ?? '—',
      hint: project.isPrivate ? 'private repository' : 'public repository',
    },
    {
      id: 'added',
      icon: Clock,
      label: 'Added',
      value: formatDate(project.addedAt),
      hint: 'to your workspace',
    },
  ];

  const handleRemove = () => {
    void remove(project.id).then((removed) => {
      if (removed) {
        navigate(ROUTES.projects, { replace: true });
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <ProjectHeader project={project} busy={busy} onRemove={handleRemove} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <ProjectStatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <EmptyState
        icon={MessagesSquare}
        title="No sessions yet"
        description="Sessions on this repository will show up here."
      />

      <EmptyState
        icon={CloudUpload}
        title="No deployments yet"
        description="Deployments will appear once this project ships."
      />
    </div>
  );
};
