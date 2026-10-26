import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { compactInstructions } from '../src/features/sessions/lib/compactCommand.ts';

test('bare and guided compaction, including multiline instructions', () => {
  assert.equal(compactInstructions('/compact'), '');
  assert.equal(compactInstructions('  /compact \n '), '');
  assert.equal(compactInstructions('/compact Keep decisions\nCondense logs'), 'Keep decisions\nCondense logs');
});

test('only an exact leading command is intercepted', () => {
  for (const text of ['', '/', '/comp', '/compactly', '/compact/foo', 'Explain /compact']) {
    assert.equal(compactInstructions(text), null);
  }
});
