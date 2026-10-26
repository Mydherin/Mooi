import { useState, type KeyboardEvent } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { normalizeTodoText } from '@/features/todos/lib/normalizeTodoText';
import type { TodoItem } from '@/features/todos/types/TodoItem';
import { cn } from '@/shared/utils/cn';

interface TodoRowProps {
  item: TodoItem;
  /** Texts of the other items, so an edit cannot turn one item into a copy of another. */
  taken: (text: string) => boolean;
  onToggle: () => void;
  onEdit: (next: string) => void;
  onRemove: () => void;
}

const rowAction =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/** Actions show on hover with a pointer and stay visible on touch screens, where nothing hovers. */
export const TodoRow = ({ item, taken, onToggle, onEdit, onRemove }: TodoRowProps) => {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const next = normalizeTodoText(draft);
    setDraft(null);
    if (next && next !== item.text && !taken(next)) onEdit(next);
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') setDraft(null);
  };

  return (
    <li className="group/todo flex min-h-12 animate-fade-in items-center gap-3 px-3 py-1.5 transition-colors hover:bg-surface-2/60 sm:px-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? `Reopen “${item.text}”` : `Complete “${item.text}”`}
        onClick={onToggle}
        className="flex size-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      >
        <span
          className={cn(
            'flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-200 ease-out-expo active:scale-90',
            item.done ? 'border-success-dot bg-success-dot text-white' : 'border-line-strong bg-surface group-hover/todo:border-ink-subtle',
          )}
        >
          <Check strokeWidth={3} className={cn('size-3 transition-[opacity,transform] duration-200', item.done ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} />
        </span>
      </button>

      {draft !== null ? (
        <input
          autoFocus
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          aria-label="Edit to-do"
          className="h-9 min-w-0 flex-1 rounded-md border border-brand/60 bg-surface px-2 text-sm font-medium text-ink ring-4 ring-brand/12 focus:outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => setDraft(item.text)}
          className={cn(
            'min-w-0 flex-1 py-1.5 text-sm leading-snug [overflow-wrap:anywhere] transition-colors duration-200',
            item.done ? 'text-ink-subtle line-through decoration-line-strong' : 'font-medium text-ink',
          )}
        >
          {item.text}
        </span>
      )}

      {draft === null ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/todo:opacity-100 [@media(hover:hover)]:group-hover/todo:opacity-100">
          <button type="button" onClick={() => setDraft(item.text)} aria-label={`Edit “${item.text}”`} title="Edit" className={rowAction}>
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={onRemove} aria-label={`Remove “${item.text}”`} title="Remove"
            className={cn(rowAction, 'hover:bg-danger-soft hover:text-danger')}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}
    </li>
  );
};
