import type { ChangeKind } from '@/features/sessions/types/ChangeKind';
import type { ChangedFile } from '@/features/sessions/types/ChangedFile';
import { cn } from '@/shared/utils/cn';

interface ChangedFileRowProps {
  file: ChangedFile;
  selected: boolean;
  onSelect: (id: string) => void;
}

const letters: Record<ChangeKind, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
};

const letterStyles: Record<ChangeKind, string> = {
  added: 'bg-success-soft text-success',
  modified: 'bg-info-soft text-info',
  deleted: 'bg-danger-soft text-danger',
};

export const ChangedFileRow = ({ file, selected, onSelect }: ChangedFileRowProps) => {
  const separator = file.path.lastIndexOf('/');
  const directory = separator === -1 ? '' : file.path.slice(0, separator + 1);
  const filename = separator === -1 ? file.path : file.path.slice(separator + 1);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(file.id)}
        aria-pressed={selected}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
          selected ? 'bg-brand-soft text-brand' : 'hover:bg-surface-2',
        )}
      >
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold',
            letterStyles[file.kind],
          )}
        >
          {letters[file.kind]}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="text-ink-subtle">{directory}</span>
          <span className={selected ? 'text-brand' : 'text-ink'}>{filename}</span>
        </span>

        <span className="shrink-0 font-mono text-[11px] text-success">+{file.added}</span>
        <span className="shrink-0 font-mono text-[11px] text-danger">−{file.removed}</span>
      </button>
    </li>
  );
};
