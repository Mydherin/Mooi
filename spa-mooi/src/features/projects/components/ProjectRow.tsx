import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Factory, FolderOpen, GitBranch, Globe, KeyRound, Lock, Pencil, Star } from 'lucide-react';
import { projectPath } from '@/app/paths';
import { factoryNeedsAttention } from '@/features/factory/lib/factoryNeedsAttention';
import type { Project } from '@/features/projects/types/Project';
import { Badge } from '@/shared/components/data-display/Badge';
import { Initials } from '@/shared/components/data-display/Initials';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { useLongPress } from '@/shared/gestures/useLongPress';
import { formatDate } from '@/shared/utils/formatDate';
import { useLiveStore } from '@/stores/liveStore';

interface ProjectRowProps {
  project: Project;
  onEdit: (project: Project) => void;
  onEnvironment: (project: Project) => void;
}

/** One project of the workspace: tapping opens it; its quick actions live in its menu (also on long press). */
export const ProjectRow = memo(({ project, onEdit, onEnvironment }: ProjectRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const press = useLongPress(() => setMenuOpen(true));
  const factoryAttention = useLiveStore((live) => factoryNeedsAttention(live.factories[project.id]));
  const to = projectPath(project.id);

  return (
    <li className="flex min-h-18 min-w-0 items-center gap-1 bg-surface pr-2">
      <Link to={to} {...press}
        className="group flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 outline-none active:bg-surface-2 focus-visible:bg-surface-2 hover-device:hover:bg-surface-2/60">
        <Initials value={project.name} size="md" className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <TruncatedText text={project.name} className="min-w-0 text-body font-semibold text-ink" />
            {project.isPrivate ? <Lock aria-label="Private" className="size-3.5 shrink-0 text-ink-subtle" /> : null}
          </span>
          <TruncatedText text={project.description ?? project.fullName} lines={2}
            className="mt-0.5 text-footnote text-ink-muted" mono={!project.description} />
          <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-subtle">
            {project.language ? <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-info-dot" />{project.language}</span> : null}
            <span className="flex min-w-0 items-center gap-1"><GitBranch aria-hidden className="size-3 shrink-0" />
              <span className="truncate font-mono">{project.defaultBranch ?? '—'}</span></span>
            <span className="flex items-center gap-1 tabular-nums"><Star aria-label="Stars" className="size-3" />{project.stars}</span>
            {project.webApplication ? <span className="flex items-center gap-1 text-brand"><Globe aria-hidden className="size-3" />Web app</span> : null}
            <span>Added {formatDate(project.addedAt)}</span>
          </span>
          {factoryAttention ? <Badge tone="warning" icon={Factory} className="mt-2">Factory needs you</Badge> : null}
        </span>
        <ChevronRight aria-hidden className="mt-2.5 size-4 shrink-0 text-ink-subtle" />
      </Link>
      <Menu label={`${project.name} actions`} open={menuOpen} onOpenChange={setMenuOpen} sections={[
        { id: 'main', items: [
          { id: 'open', label: 'Open project', icon: FolderOpen, to },
          { id: 'github', label: 'Open on GitHub', icon: ArrowUpRight, href: project.htmlUrl ?? undefined, hidden: !project.htmlUrl },
        ] },
        { id: 'settings', items: [
          { id: 'variables', label: 'Environment variables', icon: KeyRound, onSelect: () => onEnvironment(project) },
          { id: 'edit', label: 'Edit project', icon: Pencil, onSelect: () => onEdit(project) },
        ] },
      ]} />
    </li>
  );
});

ProjectRow.displayName = 'ProjectRow';
