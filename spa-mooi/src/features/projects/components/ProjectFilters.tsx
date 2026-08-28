import { projectFilters } from '@/features/projects/data/projectFilters';
import type { ProjectFilterId } from '@/features/projects/types/ProjectFilterId';
import { cn } from '@/shared/utils/cn';

interface ProjectFiltersProps {
  value: ProjectFilterId;
  onChange: (value: ProjectFilterId) => void;
}

export const ProjectFilters = ({ value, onChange }: ProjectFiltersProps) => (
  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    {projectFilters.map((filter) => (
      <button
        key={filter.id}
        type="button"
        onClick={() => onChange(filter.id)}
        aria-pressed={filter.id === value}
        className={cn(
          'h-10 shrink-0 rounded-xl border px-3.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          filter.id === value
            ? 'border-brand/40 bg-brand-soft text-brand'
            : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
        )}
      >
        {filter.label}
      </button>
    ))}
  </div>
);
