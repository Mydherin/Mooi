/** Recognize only literal shell words; never evaluate shell syntax or expansions. */
const literalWords = (command: string): string[] | null => {
  const words: string[] = [];
  let word = '';
  let quote = '';
  let started = false;

  for (const character of command.trim()) {
    if (/[\n\r\x00-\x1f\x7f]/.test(character)) return null;
    if (quote) {
      if (character === quote) quote = '';
      else {
        if (quote === '"' && /[$`\\]/.test(character)) return null;
        word += character;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) words.push(word);
      word = '';
      started = false;
    } else {
      if (/[;&|<>()$`\\*?\[\]{}~#]/.test(character)) return null;
      word += character;
      started = true;
    }
  }
  if (quote) return null;
  if (started) words.push(word);
  return words;
};

export const summarizeCommand = (command: unknown) => {
  const fallback = { category: 'Run command', detail: '' };
  if (typeof command !== 'string') return fallback;
  const words = literalWords(command);
  if (!words?.length) return fallback;
  const [name, ...args] = words;

  if (name === 'ls') {
    const paths: string[] = [];
    let options = true;
    for (const arg of args) {
      if (options && arg === '--') options = false;
      else if (options && arg.startsWith('-') && arg !== '-') {
        // Only flags with no argument: unknown options may consume the next word.
        if (!/^-[aAbBcCdDfFgGhHiklLmnopqQrRsStuUvwx1]+$/.test(arg)) return fallback;
      } else paths.push(arg);
    }
    if (paths.length > 1 || paths.some((path) => !path)) return fallback;
    return { category: 'Listed directory', detail: paths[0] ?? '.' };
  }

  if (name === 'find') {
    // Restrict summaries to simple searches; actions and unfamiliar predicates are ambiguous.
    const predicates = new Set(['-name', '-iname', '-path', '-ipath', '-type', '-maxdepth', '-mindepth']);
    let position = 0;
    while (['-H', '-L', '-P'].includes(args[position])) position += 1;
    if (position < args.length && !args[position].startsWith('-')) position += 1;
    while (position < args.length) {
      if (!predicates.has(args[position]) || !args[position + 1]) return fallback;
      position += 2;
    }
    return { category: 'Searched for', detail: args.join(' ') || '.' };
  }

  return fallback;
};
