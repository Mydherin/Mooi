import { ConnectRepoCard } from '@/features/projects/components/ConnectRepoCard';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import type { Project } from '@/features/projects/types/Project';

interface ProjectGridProps {
  projects: Project[];
}

export const ProjectGrid = ({ projects }: ProjectGridProps) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {projects.map((project) => (
      <ProjectCard key={project.id} project={project} />
    ))}
    <ConnectRepoCard />
  </div>
);
