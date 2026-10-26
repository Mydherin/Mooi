import type { TodoChange } from '@/features/todos/types/TodoChange';
import type { TodoItem } from '@/features/todos/types/TodoItem';

const at = (items: TodoItem[], text: string): number => items.findIndex((item) => item.text === text);

/**
 * Replays pending edits on a list. An edit whose item is gone (removed elsewhere meanwhile) is
 * dropped rather than guessed, and an add never duplicates an item that already arrived.
 */
export const applyTodoChanges = (items: TodoItem[], changes: TodoChange[]): TodoItem[] =>
  changes.reduce<TodoItem[]>((list, change) => {
    if (change.kind === 'replace') return change.items.map((item) => ({ ...item }));
    if (change.kind === 'add') return at(list, change.text) >= 0 ? list : [...list, { text: change.text, done: false }];
    const index = at(list, change.text);
    if (index < 0) return list;
    if (change.kind === 'remove') return list.filter((_, position) => position !== index);
    return list.map((item, position) => {
      if (position !== index) return item;
      return change.kind === 'toggle' ? { ...item, done: change.done } : { ...item, text: change.next };
    });
  }, items);
