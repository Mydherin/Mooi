import type { DiffLine } from '@/features/sessions/types/DiffLine';
import type { DiffLineKind } from '@/features/sessions/types/DiffLineKind';
import { cn } from '@/shared/utils/cn';

interface DiffLineRowProps {
  line: DiffLine;
}

const rowStyles: Record<DiffLineKind, string> = {
  hunk: 'bg-surface-2 text-ink-subtle',
  add: 'bg-success-soft text-ink',
  remove: 'bg-danger-soft text-ink',
  context: 'text-ink-muted',
};

const markers: Record<DiffLineKind, string> = {
  hunk: ' ',
  add: '+',
  remove: '−',
  context: ' ',
};

export const DiffLineRow = ({ line }: DiffLineRowProps) => (
  <div className={cn('flex min-w-max', rowStyles[line.kind])}>
    <span className="w-10 shrink-0 pr-2 text-right select-none text-ink-subtle">
      {line.oldLine ?? ''}
    </span>
    <span className="w-10 shrink-0 pr-2 text-right select-none text-ink-subtle">
      {line.newLine ?? ''}
    </span>
    <span className="w-4 shrink-0 select-none text-center">{markers[line.kind]}</span>
    <span className="pr-4 pl-3 whitespace-pre">{line.content}</span>
  </div>
);
