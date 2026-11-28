import type { CommandDescription } from './CommandDescription';
import { basename, described, SHELLS, shellScript } from './commandWords';
import { describeLine } from './describeLine';
import { splitCommands } from './splitCommands';

/** Peels `bash -lc "…"` (how Codex reports every command) so the user reads what actually ran. */
const unwrapShell = (command: string): string => {
  const commands = splitCommands(command);
  const words = commands[0]?.words;
  if (words?.length && commands.length === 1 && SHELLS.has(basename(words[0]))) {
    const script = shellScript(words.slice(1));
    if (script) return unwrapShell(script);
  }
  return command.trim();
};

/** An argv array (Codex) becomes one shell-quoted line, the way a user would type it. */
const commandText = (command: unknown): string => typeof command === 'string' ? command : Array.isArray(command)
  ? command.map((word) => /[\s'"]/.test(String(word)) ? `'${String(word).replace(/'/g, "'\\''")}'` : String(word)).join(' ') : '';

/**
 * What a shell command is *for*, read the way Claude Code and Codex present it: `rg -n useState src`
 * becomes "Searched for useState in src", `npm test` becomes "Ran tests". Purely cosmetic and never
 * executed — the parser only splits words, so a command it does not recognise still renders, as
 * "Ran <command>". The expanded step always shows the command itself, so a summary can never hide it.
 */
export const describeCommand = (command: unknown): CommandDescription => {
  const display = unwrapShell(commandText(command));
  const description = display ? describeLine(display) : null;
  return { ...(description ?? { ...described('command', 'Running command', 'Ran command', null), steps: [] }), display };
};
