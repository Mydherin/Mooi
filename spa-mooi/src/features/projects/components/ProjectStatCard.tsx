import type { ProjectStat } from '@/features/projects/types/ProjectStat';
import { Card } from '@/shared/components/Card';

interface ProjectStatCardProps {
  stat: ProjectStat;
}

export const ProjectStatCard = ({ stat }: ProjectStatCardProps) => {
  const Icon = stat.icon;

  return (
    <Card className="p-4">
      <span className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-ink-subtle uppercase">
        <Icon className="size-3.5" />
        {stat.label}
      </span>
      <p className="mt-3 truncate text-xl font-semibold tracking-tight text-ink">{stat.value}</p>
      <p className="mt-1 truncate text-xs text-ink-subtle">{stat.hint}</p>
    </Card>
  );
};
