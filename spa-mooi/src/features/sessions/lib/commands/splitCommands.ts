/** One simple command of a command line, with the files its output redirections write. */
export interface SimpleCommand {
  words: string[];
  writes: string[];
  /** Fed by a pipe (`… | tail -5`): it shapes the previous command's output. */
  piped: boolean;
}

/** Splits a command line into simple commands (on `&&`, `||`, `;`, `|`, `&`, newlines), honouring
 * quotes, keeping output redirection targets and skipping heredoc bodies — a body is data, never
 * more commands. Good enough to name a command, never to run one. */
export const splitCommands = (command: string): SimpleCommand[] => {
  const commands: SimpleCommand[] = [];
  let words: string[] = [];
  let writes: string[] = [];
  let word = '';
  let started = false;
  let quote = '';
  // What the next word is: a plain word, the target of `>` (a write) or of `<` (ignored).
  let next: 'word' | 'write' | 'drop' = 'word';
  let piped = false;
  const heredocs: string[] = [];

  const endWord = () => {
    if (started) {
      if (next === 'write' && !word.startsWith('/dev/')) writes.push(word);
      else if (next === 'word') words.push(word);
      next = 'word';
    }
    word = '';
    started = false;
  };
  const endCommand = (pipe = false) => {
    endWord();
    if (words.length || writes.length) commands.push({ words, writes, piped });
    words = [];
    writes = [];
    piped = pipe;
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) quote = '';
      else if (character === '\\' && quote === '"' && index + 1 < command.length) word += command[++index];
      else word += character;
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (character === '\\' && index + 1 < command.length) {
      if (command[index + 1] !== '\n') {
        word += command[index + 1];
        started = true;
      }
      index += 1;
    } else if (character === '\n' && heredocs.length) {
      endCommand();
      // Skip each pending heredoc body, up to and including its delimiter line.
      for (const delimiter of heredocs.splice(0)) {
        let lineEnd = command.indexOf('\n', index + 1);
        while (lineEnd !== -1 && command.slice(index + 1, lineEnd).trim() !== delimiter) {
          index = lineEnd;
          lineEnd = command.indexOf('\n', index + 1);
        }
        index = lineEnd === -1 ? command.length : lineEnd;
      }
    } else if (/[;&|\n]/.test(character)) {
      // `2>&1` is a redirection, not a background `&`.
      if (character === '&' && command[index - 1] === '>') continue;
      const pipe = character === '|' && command[index + 1] !== '|' && command[index - 1] !== '|';
      if (character === '|' && command[index + 1] === '|') index += 1;
      endCommand(pipe);
    } else if (character === '>' || character === '<') {
      // A file-descriptor prefix such as `2>` belongs to the redirection.
      if (/^\d+$/.test(word)) {
        word = '';
        started = false;
      } else endWord();
      if (character === '<' && command[index + 1] === '<' && command[index + 2] !== '<') {
        index += 1;
        if (command[index + 1] === '-') index += 1;
        while (command[index + 1] === ' ' || command[index + 1] === '\t') index += 1;
        const delimiter = /^(['"]?)([^\s'";&|<>()]+)\1/.exec(command.slice(index + 1));
        if (delimiter) {
          heredocs.push(delimiter[2]);
          index += delimiter[0].length;
        }
        continue;
      }
      while (command[index + 1] === character || command[index + 1] === '&' || command[index + 1] === '|') index += 1;
      // `>&1` names a descriptor; otherwise the next word is the target file (or, for `<`, the input).
      if (command[index] === '&' && /\d/.test(command[index + 1] ?? '')) index += 1;
      else next = character === '>' ? 'write' : 'drop';
    } else if (/\s/.test(character)) {
      endWord();
    } else {
      word += character;
      started = true;
    }
  }
  endCommand();
  return commands;
};
