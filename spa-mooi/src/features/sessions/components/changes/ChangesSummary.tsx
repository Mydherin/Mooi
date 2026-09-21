import { GitMerge } from 'lucide-react';
import type { ChangesSummary as ChangesSummaryData } from '@/features/sessions/types/ChangesSummary';
import { Button } from '@/shared/components/Button';

interface ChangesSummaryProps {
  summary: ChangesSummaryData | null;
}

export const ChangesSummary = ({ summary }: ChangesSummaryProps) => {
  const fileCount = summary?.files.length ?? 0;

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
      <span className="text-[13px] font-extrabold text-ink">
        {fileCount} {fileCount === 1 ? 'file' : 'files'} changed
      </span>
      <span className="font-mono text-[11px] font-medium text-success">+{summary?.added ?? 0}</span>
      <span className="font-mono text-[11px] font-medium text-danger">−{summary?.removed ?? 0}</span>

      <Button variant="secondary" size="sm" disabled ariaLabel="Merge to main — not available yet" className="ml-auto hidden sm:inline-flex">
        <GitMerge className="size-4" />
        Merge to main
      </Button>
    </div>
  );
};
