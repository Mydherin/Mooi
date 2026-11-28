import { FolderPlus, Plus } from 'lucide-react';
import type { Project } from '@/features/projects/types/Project';
import { Initials } from '@/shared/components/data-display/Initials';
import type { SelectAction } from '@/shared/components/forms/select/SelectAction';
import { Select } from '@/shared/components/forms/select/Select';

interface ProjectSelectProps {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string) => void;
  /** Import an existing GitHub repository; omitted when GitHub is not linked. */
  onImport?: () => void;
  /** Create a new repository; omitted when GitHub is not linked. */
  onCreate?: () => void;
}

/** Project picker for dialogs, ending with the ways to add a project without leaving the flow. */
export const ProjectSelect = ({ projects, value, onChange, onImport, onCreate }: ProjectSelectProps) => {
  const actions: SelectAction[] = [
    ...(onImport ? [{ id: 'import', label: 'Add repository', icon: Plus, onSelect: onImport }] : []),
    ...(onCreate ? [{ id: 'create', label: 'Create project', icon: FolderPlus, onSelect: onCreate }] : []),
  ];

  return (
    <Select label="Project" value={value} onChange={onChange} actions={actions}
      placeholder={`Select a project · ${projects.length} in your workspace`} emptyText="No projects yet. Add one below."
      options={projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.fullName,
        leading: <Initials value={project.name} size="sm" />,
      }))} />
  );
};
