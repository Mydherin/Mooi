import { Link } from 'react-router-dom';
import { ArrowRight, FolderGit2, Plus, UserRound } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard';
import { GithubGateCard } from '@/features/github/components/GithubGateCard';
import { useGithubLinked } from '@/features/github/hooks/useGithubLinked';
import { ProjectGrid } from '@/features/projects/components/ProjectGrid';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { GithubMark } from '@/shared/components/icons/GithubMark';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatDate } from '@/shared/utils/formatDate';
import { useAuthStore } from '@/stores/authStore';
import { useGithubStore } from '@/stores/githubStore';

const RECENT_PROJECTS = 6;

/**
 * The homepage of a signed-in player.
 *
 * While GitHub is unlinked it shows the connect card and nothing else: an empty stat row and an
 * empty project grid underneath would read as a workspace that is broken, when in fact it has not
 * been given anything to work on yet.
 */
export const DashboardPage = () => {
  const player = useAuthStore((state) => state.player);
  const connection = useGithubStore((state) => state.connection);
  const { linked, resolved } = useGithubLinked();
  const { projects, status } = useProjects();

  if (!player) {
    return null;
  }

  const recentProjects = projects.slice(0, RECENT_PROJECTS);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Welcome back, {player.username}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">Your GitHub-based workspace.</p>

      {resolved && !linked ? (
        <div className="mt-6">
          <GithubGateCard
            title="Start by connecting GitHub"
            description="Mooi works on your own repositories. Nothing can run until your GitHub account is linked — it takes one click."
          />
        </div>
      ) : null}

      {linked && connection ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <DashboardStatCard
              icon={<FolderGit2 className="size-3.5" />}
              label="Projects"
              value={String(projects.length)}
              hint={projects.length === 1 ? 'repository added' : 'repositories added'}
            />
            <DashboardStatCard
              icon={<GithubMark className="size-3.5" />}
              label="GitHub"
              value={connection.login}
              hint={`Linked ${formatDate(connection.connectedAt)}`}
            />
            <DashboardStatCard
              icon={<UserRound className="size-3.5" />}
              label="Account"
              value={player.role === 'admin' ? 'Admin' : 'Player'}
              hint={player.email}
            />
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-ink">Recent projects</h2>
              <Link to={ROUTES.projects} className={buttonStyles('ghost', 'sm', '-mr-3.5')}>
                All projects
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="mt-3">
              {status === 'loading' && projects.length === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2].map((card) => (
                    <Card key={card} className="h-[190px] animate-pulse-soft" />
                  ))}
                </div>
              ) : null}

              {status !== 'loading' && projects.length === 0 ? (
                <EmptyState
                  icon={FolderGit2}
                  title="No projects yet"
                  description="Add a GitHub repository to start working on it here."
                >
                  <Link to={ROUTES.projects} className={buttonStyles('brand', 'md')}>
                    <Plus className="size-4" />
                    Add repository
                  </Link>
                </EmptyState>
              ) : null}

              {recentProjects.length > 0 ? <ProjectGrid projects={recentProjects} /> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};
