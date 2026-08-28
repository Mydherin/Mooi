import { DiffLineRow } from '@/features/sessions/components/changes/DiffLineRow';
import { diffSample } from '@/features/sessions/data/diffSample';

interface DiffViewProps {
  path: string;
}

export const DiffView = ({ path }: DiffViewProps) => (
  <div className="min-h-0 flex-1 overflow-auto">
    <p className="sticky top-0 z-10 truncate border-b border-line bg-surface px-4 py-2 font-mono text-xs text-ink-subtle">
      {path}
    </p>

    <div className="py-2 font-mono text-xs leading-relaxed">
      {diffSample.map((line) => (
        <DiffLineRow key={line.id} line={line} />
      ))}
    </div>
  </div>
);
