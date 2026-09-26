import { FileDiff, FolderGit2, HardDrive, Radio } from 'lucide-react';
import { WorkspaceStat } from '@/features/sessions/components/workspaces/WorkspaceStat';
import type { WorkspaceOverview } from '@/features/sessions/types/WorkspaceOverview';
import { cn } from '@/shared/utils/cn';
import { formatBytes } from '@/shared/utils/formatBytes';

interface WorkspaceStatsProps {
  overview: WorkspaceOverview;
  previewsEnabled: boolean;
}

export const WorkspaceStats = ({ overview, previewsEnabled }: WorkspaceStatsProps) => {
  const { workspaces } = overview;
  const cloned = workspaces.filter((workspace) => workspace.path).length;
  const dirtyFiles = workspaces.reduce((total, workspace) => total + workspace.dirtyFiles, 0);
  const dirtyClones = workspaces.filter((workspace) => workspace.dirtyFiles > 0).length;
  const running = workspaces.filter((workspace) => workspace.deploymentState === 'running').length;
  const branches = new Set(workspaces.map((workspace) => workspace.branch)).size;
  // A preview still running after the project was re-marked keeps its tile until it is stopped.
  const showPreviews = previewsEnabled || running > 0;

  return (
    <div className={cn('grid grid-cols-2 gap-3', showPreviews ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
      <WorkspaceStat
        icon={FolderGit2}
        label="Clones"
        value={String(cloned)}
        hint={`${branches} ${branches === 1 ? 'branch' : 'branches'}${cloned < workspaces.length ? ` · ${workspaces.length - cloned} pending` : ''}`}
      />
      <WorkspaceStat icon={HardDrive} label="Disk" value={formatBytes(overview.totalBytes)} hint="Across all clones" />
      <WorkspaceStat
        icon={FileDiff}
        label="Uncommitted"
        value={String(dirtyFiles)}
        hint={`${dirtyClones} dirty ${dirtyClones === 1 ? 'clone' : 'clones'}`}
      />
      {showPreviews ? (
        <WorkspaceStat icon={Radio} label="Previews" value={String(running)} hint="Running deployments" />
      ) : null}
    </div>
  );
};
