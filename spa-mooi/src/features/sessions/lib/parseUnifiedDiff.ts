import type { DiffLine } from '@/features/sessions/types/DiffLine';

const skippedPrefixes = [
  'diff --git',
  'index ',
  '--- ',
  '+++ ',
  'new file mode',
  'deleted file mode',
  'old mode',
  'new mode',
  'similarity index',
  'rename from',
  'rename to',
];

/**
 * Turns the unified diff text `mic-sessions` returns for one file into the flat `DiffLine[]`
 * `DiffLineRow` renders. Hunk headers and file-mode/rename preamble lines both render with the
 * `hunk` style — it doubles as the generic "meta" row, there is no separate kind for it.
 */
export const parseUnifiedDiff = (diff: string): DiffLine[] => {
  const lines: DiffLine[] = [];
  const rawLines = diff.split('\n');

  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  let oldLine = 0;
  let newLine = 0;
  let id = 0;

  for (const raw of rawLines) {
    if (skippedPrefixes.some((prefix) => raw.startsWith(prefix))) {
      continue;
    }

    if (raw.startsWith('\\')) {
      continue;
    }

    if (raw.startsWith('Binary files')) {
      lines.push({ id: `d${id++}`, kind: 'hunk', oldLine: null, newLine: null, content: raw });
      continue;
    }

    if (raw.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      oldLine = match ? Number(match[1]) : 0;
      newLine = match ? Number(match[2]) : 0;
      lines.push({ id: `d${id++}`, kind: 'hunk', oldLine: null, newLine: null, content: raw });
      continue;
    }

    if (raw.startsWith('+')) {
      lines.push({ id: `d${id++}`, kind: 'add', oldLine: null, newLine: newLine++, content: raw.slice(1) });
      continue;
    }

    if (raw.startsWith('-')) {
      lines.push({ id: `d${id++}`, kind: 'remove', oldLine: oldLine++, newLine: null, content: raw.slice(1) });
      continue;
    }

    lines.push({ id: `d${id++}`, kind: 'context', oldLine: oldLine++, newLine: newLine++, content: raw.slice(1) });
  }

  return lines;
};
