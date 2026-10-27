import type { TodoChange } from '@/features/todos/types/TodoChange';
import type { TodoItem } from '@/features/todos/types/TodoItem';

const at = (items: TodoItem[], text: string): number => items.findIndex((item) => item.text === text);

/** Lifts `text` out and puts it back next to `anchor`; either one gone leaves the list as it is. */
const move = (items: TodoItem[], text: string, anchor: string, place: 'before' | 'after'): TodoItem[] => {
  const from = at(items, text);
  if (from < 0 || text === anchor || at(items, anchor) < 0) return items;
  const rest = items.filter((_, position) => position !== from);
  const to = at(rest, anchor) + (place === 'after' ? 1 : 0);
  return [...rest.slice(0, to), items[from], ...rest.slice(to)];
};

/**
 * Replays pending edits on a list. An edit whose item is gone (removed elsewhere meanwhile) is
 * dropped rather than guessed, and an add never duplicates an item that already arrived.
 */
export const applyTodoChanges = (items: TodoItem[], changes: TodoChange[]): TodoItem[] =>
  changes.reduce<TodoItem[]>((list, change) => {
    if (change.kind === 'replace') return change.items.map((item) => ({ ...item }));
    if (change.kind === 'add') return at(list, change.text) >= 0 ? list : [...list, { text: change.text, status: 'open' }];
    if (change.kind === 'move') return move(list, change.text, change.anchor, change.place);
    const index = at(list, change.text);
    if (index < 0) return list;
    if (change.kind === 'remove') return list.filter((_, position) => position !== index);
    return list.map((item, position) => {
      if (position !== index) return item;
      return change.kind === 'status' ? { ...item, status: change.status } : { ...item, text: change.next };
    });
  }, items);
