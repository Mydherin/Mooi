import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { applyTodoChanges } from '../src/features/todos/lib/applyTodoChanges.ts';
import type { TodoItem } from '../src/features/todos/types/TodoItem.ts';

const list = (...texts: string[]): TodoItem[] => texts.map((text) => ({ text, status: 'open' }));
const texts = (items: TodoItem[]): string[] => items.map((item) => item.text);

test('a move lands before or after its anchor, up or down', () => {
  const items = list('a', 'b', 'c', 'd');
  assert.deepEqual(texts(applyTodoChanges(items, [{ kind: 'move', text: 'a', anchor: 'c', place: 'after' }])), ['b', 'c', 'a', 'd']);
  assert.deepEqual(texts(applyTodoChanges(items, [{ kind: 'move', text: 'd', anchor: 'b', place: 'before' }])), ['a', 'd', 'b', 'c']);
  assert.deepEqual(texts(applyTodoChanges(items, [{ kind: 'move', text: 'a', anchor: 'd', place: 'after' }])), ['b', 'c', 'd', 'a']);
});

test('a move whose item or anchor is gone leaves the list as it is', () => {
  const items = list('a', 'b');
  for (const change of [
    { kind: 'move', text: 'x', anchor: 'a', place: 'after' },
    { kind: 'move', text: 'a', anchor: 'x', place: 'after' },
    { kind: 'move', text: 'a', anchor: 'a', place: 'after' },
  ] as const) {
    assert.deepEqual(applyTodoChanges(items, [change]), items);
  }
});

test('a move replays on a list that changed meanwhile', () => {
  // Dropped "c" after "a" on [a, b, c]; an agent inserted "z" first in the meantime.
  const newer = list('z', 'a', 'b', 'c');
  assert.deepEqual(texts(applyTodoChanges(newer, [{ kind: 'move', text: 'c', anchor: 'a', place: 'after' }])), ['z', 'a', 'c', 'b']);
});

test('statuses change by text, and added items start open', () => {
  const items = applyTodoChanges(list('a'), [
    { kind: 'status', text: 'a', status: 'inProgress' },
    { kind: 'add', text: 'b' },
    { kind: 'status', text: 'b', status: 'done' },
  ]);
  assert.deepEqual(items, [{ text: 'a', status: 'inProgress' }, { text: 'b', status: 'done' }]);
});
