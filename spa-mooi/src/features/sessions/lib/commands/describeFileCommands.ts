import { basename, described, flagValue, isFlag, operands } from './commandWords';

/** Commands that read, search or list files: `cat`, `sed -n`, `rg`, `grep`, `find`, `fd`. */

const SEARCH_VALUED = new Set(['-g', '--glob', '-t', '--type', '-T', '-A', '-B', '-C', '-m', '--max-count', '--include',
  '--exclude', '--exclude-dir', '-f', '--file', '-d', '--max-depth', '--context', '--before-context', '--after-context']);

export const describeRead = (name: string, args: string[]) => {
  const valued = new Set(['-n', '-c', '--lines', '--bytes', '-e', '-f']);
  if (name === 'sed' || name === 'awk' || name === 'jq') {
    // The first operand is the script; the files follow it.
    const rest = operands(args, valued);
    const script = name === 'sed' ? (flagValue(args, '-n', '-e') ?? rest[0] ?? '') : rest[0] ?? '';
    const files = (name === 'sed' && flagValue(args, '-n', '-e') !== null ? rest : rest.slice(1));
    if (name === 'sed' && /\bs\//.test(script) && args.some((arg) => /^-i/.test(arg))) return null;
    if (!files.length) return null;
    const range = name === 'sed' ? /^(\d+)(?:,(\d+|\$))?p$/.exec(script) : null;
    const lines = range ? ` · lines ${range[1]}${range[2] ? `–${range[2]}` : ''}` : '';
    return described('read', 'Reading', 'Read', `${files.map(basename).join(', ')}${lines}`);
  }
  const files = operands(args, valued);
  if (!files.length) return null;
  if (name === 'wc') return described('read', 'Counting', 'Counted', files.map(basename).join(', '));
  const count = /^-?\d+$/.test(flagValue(args, '-n') ?? '') ? Math.abs(Number(flagValue(args, '-n'))) : null;
  const scope = count !== null && (name === 'head' || name === 'tail') ? ` · ${name === 'head' ? 'first' : 'last'} ${count} lines` : '';
  return described('read', 'Reading', 'Read', `${files.map(basename).join(', ')}${scope}`);
};

export const describeSearch = (args: string[]) => {
  if (args.includes('--files')) {
    const roots = operands(args, SEARCH_VALUED);
    return described('list', 'Listing files in', 'Listed files in', roots.join(', ') || '.');
  }
  const explicit = flagValue(args, '-e', '--regexp');
  const rest = operands(args, new Set([...SEARCH_VALUED, '-e', '--regexp']));
  const pattern = explicit ?? rest.shift();
  if (!pattern) return null;
  const where = rest.length ? ` in ${rest.join(', ')}` : '';
  return described('search', 'Searching for', 'Searched for', `${pattern}${where}`);
};

export const describeFind = (name: string, args: string[]) => {
  if (name === 'fd' || name === 'fdfind') {
    const rest = operands(args, new Set(['-e', '--extension', '-t', '--type', '-d', '--max-depth', '-E', '--exclude']));
    const extension = flagValue(args, '-e', '--extension');
    const pattern = rest[0] ?? (extension ? `*.${extension}` : null);
    const where = rest[1] ? ` in ${rest[1]}` : '';
    return pattern ? described('search', 'Finding files', 'Found files', `${pattern}${where}`)
      : described('list', 'Listing files in', 'Listed files in', rest[1] ?? '.');
  }
  const root = args.find((arg) => !isFlag(arg)) ?? '.';
  const pattern = flagValue(args, '-name', '-iname', '-path', '-ipath', '-regex');
  return pattern ? described('search', 'Finding files', 'Found files', `${pattern} in ${root}`)
    : described('list', 'Listing files in', 'Listed files in', root);
};
