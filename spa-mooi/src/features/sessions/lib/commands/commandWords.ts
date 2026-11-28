import type { CommandKind, Described } from './CommandDescription';

/** Word-level helpers shared by every command describer. */

const DETAIL_LIMIT = 80;

const clip = (text: string, limit = DETAIL_LIMIT): string =>
  text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;

export const basename = (path: string): string => path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || path;

export const isFlag = (word: string) => word.startsWith('-') && word !== '-';

/** Arguments that are not flags, skipping the values of flags known to take one. */
export const operands = (args: string[], valued: Set<string> = new Set()): string[] => {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      result.push(...args.slice(index + 1));
      break;
    }
    if (isFlag(arg)) {
      if (valued.has(arg)) index += 1;
      continue;
    }
    result.push(arg);
  }
  return result;
};

export const flagValue = (args: string[], ...names: string[]): string | null => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (names.includes(arg) && args[index + 1] !== undefined) return args[index + 1];
    const inline = names.find((name) => name.startsWith('--') && arg.startsWith(`${name}=`));
    if (inline) return arg.slice(inline.length + 1);
  }
  return null;
};

export const described = (kind: CommandKind, active: string, done: string, detail: string | null, target: string | null = null): Described =>
  ({ kind, active, done, detail: detail ? clip(detail) : null, target });

export const ran = (active: string, done: string, words: string[]): Described =>
  ({ ...described('command', active, done, words.join(' ')), raw: true });

export const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'fish']);
const PREFIXES = new Set(['sudo', 'time', 'nohup', 'exec', 'command', 'builtin', 'env', 'timeout', 'xargs']);

/** The script of `bash -lc '…'` and friends, or null. */
export const shellScript = (args: string[]): string | null => flagValue(args, '-c', '-lc', '-ic', '-lic');

/** Drops `FOO=bar` assignments and wrappers such as `sudo`, which never say what a command does. */
export const strip = (words: string[]): string[] => {
  let index = 0;
  while (index < words.length) {
    const word = words[index];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) index += 1;
    else if (PREFIXES.has(basename(word))) {
      index += 1;
      while (index < words.length && isFlag(words[index])) index += 1;
      if (basename(word) === 'timeout' && /^\d/.test(words[index] ?? '')) index += 1;
    } else break;
  }
  return words.slice(index);
};
