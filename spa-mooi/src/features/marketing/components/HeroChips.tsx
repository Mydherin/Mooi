import { AppWindow, FolderGit2, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface HeroChip {
  id: string;
  label: string;
  icon: LucideIcon;
}

const chips: HeroChip[] = [
  { id: 'repos', label: 'GitHub-synced projects', icon: FolderGit2 },
  { id: 'preview', label: 'Live preview in every session', icon: AppWindow },
  { id: 'deploy', label: 'One-click production deploys', icon: Rocket },
];

export const HeroChips = () => (
  <ul className="flex flex-wrap items-center justify-center gap-2">
    {chips.map((chip) => (
      <li
        key={chip.id}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-muted"
      >
        <chip.icon className="size-3.5 text-brand" />
        {chip.label}
      </li>
    ))}
  </ul>
);
