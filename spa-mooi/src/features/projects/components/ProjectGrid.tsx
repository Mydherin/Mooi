import { AddProjectTile } from '@/features/projects/components/AddProjectTile';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import type { Project } from '@/features/projects/types/Project';

interface ProjectGridProps {
  projects: Project[];
  onAdd?: () => void;
  canAdd?: boolean;
}

export const ProjectGrid = ({ projects, onAdd, canAdd = true }: ProjectGridProps) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {projects.map((project) => (
      <ProjectCard key={project.id} project={project} />
    ))}
    {onAdd ? <AddProjectTile onAdd={onAdd} disabled={!canAdd} /> : null}
  </div>
);
