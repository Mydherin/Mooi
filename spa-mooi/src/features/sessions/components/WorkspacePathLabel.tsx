import { FolderGit2 } from 'lucide-react';
import { Tooltip } from '@/shared/components/Tooltip';
import { cn } from '@/shared/utils/cn';
import { shortenPath } from '@/shared/utils/shortenPath';

interface WorkspacePathLabelProps {
  path: string | null;
  className?: string;
  focusable?: boolean;
}

/** Where a session's clone lives: a compact path, with the full one in a tooltip. */
export const WorkspacePathLabel = ({ path, className, focusable = false }: WorkspacePathLabelProps) => (
  <span className={cn('flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] text-ink-subtle', className)}>
    <FolderGit2 className="size-3 shrink-0" />
    {path ? (
      <Tooltip content={path} focusable={focusable}>
        <span className="truncate">{shortenPath(path)}</span>
      </Tooltip>
    ) : (
      <span className="truncate italic">Clone not ready yet</span>
    )}
  </span>
);
