import type { CommandDescription, Described } from './CommandDescription';
import { basename, described, isFlag, operands, ran, SHELLS, shellScript, strip } from './commandWords';
import { describeFind, describeRead, describeSearch } from './describeFileCommands';
import { describeGit } from './describeGit';
import { splitCommands, type SimpleCommand } from './splitCommands';

/*
 * One command line read for what it is for. Describing a word list can recurse into a whole line
 * (`bash -lc '…'`, `uv run …`, `npx …`), so the describers of words and lines live together.
 */

const NOISE = new Set(['cd', 'pushd', 'popd', 'export', 'set', 'source', '.', 'true', 'unset', 'ulimit']);
const READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl', 'wc', 'sed', 'awk', 'jq', 'stat', 'file', 'xxd', 'od']);
const SEARCHERS = new Set(['rg', 'grep', 'egrep', 'fgrep', 'ag', 'ack']);
const TEST_RUNNERS = new Set(['pytest', 'vitest', 'jest', 'mocha', 'playwright', 'phpunit', 'rspec', 'ava']);
const LINTERS = new Set(['eslint', 'ruff', 'biome', 'mypy', 'pyright', 'flake8', 'pylint', 'stylelint', 'golangci-lint', 'shellcheck']);
const FORMATTERS = new Set(['prettier', 'black', 'isort', 'gofmt', 'rustfmt', 'dprint']);

/** `npm run test:unit`, `pnpm build`, `yarn add zod`, `bun x tsc`: a script name says what it is for. */
const describeScript = (script: string, words: string[]) => {
  if (/^test|:test|^e2e|spec/.test(script)) return ran('Running tests', 'Ran tests', words);
  if (/^build|:build/.test(script)) return ran('Building', 'Built', words);
  if (/^type-?check|^tsc|:types/.test(script)) return ran('Type-checking', 'Type-checked', words);
  if (/^lint|:lint/.test(script)) return ran('Linting', 'Linted', words);
  if (/^format|^fmt|prettier/.test(script)) return ran('Formatting', 'Formatted', words);
  if (/^dev|^start|^serve|^preview/.test(script)) return ran('Starting dev server', 'Started dev server', words);
  return ran('Running script', 'Ran script', words);
};

const describePackageManager = (name: string, words: string[]) => {
  const args = words.slice(1);
  const sub = args.find((arg) => !isFlag(arg));
  if (!sub) return null;
  const rest = args.slice(args.indexOf(sub) + 1);
  if (['install', 'i', 'ci', 'add', 'sync', 'update', 'upgrade', 'remove', 'uninstall'].includes(sub)
    || (sub === 'pip' && rest[0] === 'install')) {
    const removing = sub === 'remove' || sub === 'uninstall';
    return ran(removing ? 'Removing dependencies' : 'Installing dependencies', removing ? 'Removed dependencies' : 'Installed dependencies', words);
  }
  if (sub === 'run' || sub === 'run-script') {
    // `uv run pytest` / `poetry run mypy`: the wrapped tool is what matters.
    if (name === 'uv' || name === 'poetry' || name === 'pipenv') return describeWords(rest) ?? null;
    return rest[0] ? describeScript(rest[0], words) : null;
  }
  if (sub === 'exec' || sub === 'x' || sub === 'dlx') return describeWords(rest) ?? null;
  if (sub === 'test' || sub === 't') return ran('Running tests', 'Ran tests', words);
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(name)) return describeScript(sub, words);
  return null;
};

const RTK_WRAPPERS = new Set(['proxy', 'bypass', 'err', 'test', 'summary']);

/** `rtk git status`, `rtk read a.ts`, `rtk proxy make`: RTK only compresses the output of the command
 * it wraps, so the wrapped command says what it is for. */
const describeRtk = (args: string[]): Described | null => {
  const [sub, ...rest] = args;
  if (sub === 'read') {
    const files = operands(rest, new Set(['-l', '--level', '-m', '--max-lines', '--head-lines', '--tail-lines']));
    return files.length ? described('read', 'Reading', 'Read', files.map(basename).join(', ')) : null;
  }
  return describeWords(sub && RTK_WRAPPERS.has(sub) ? rest : args);
};

/** Describes one simple command, or null when it carries no recognisable intent. */
const describeWords = (input: string[]): Described | null => {
  const words = strip(input);
  if (!words.length) return null;
  const name = basename(words[0]);
  const args = words.slice(1);

  if (SHELLS.has(name)) {
    const script = shellScript(args);
    return script ? describeLine(script) : null;
  }
  if (name === 'rtk') return describeRtk(args);
  if (READERS.has(name)) return describeRead(name, args);
  if (SEARCHERS.has(name)) return describeSearch(args);
  if (name === 'find' || name === 'fd' || name === 'fdfind') return describeFind(name, args);
  if (name === 'ls' || name === 'tree' || name === 'eza' || name === 'exa') {
    return described('list', 'Listing', 'Listed', operands(args, new Set(['-L', '-I', '--level'])).join(', ') || '.');
  }
  if (name === 'pwd') return described('list', 'Checking working directory', 'Checked working directory', null);
  if (name === 'git') return describeGit(words);
  if (name === 'gh') return ran('Querying GitHub', 'Queried GitHub', words);
  if (['npm', 'pnpm', 'yarn', 'bun', 'uv', 'pip', 'pip3', 'poetry', 'pipenv', 'cargo', 'go', 'composer', 'bundle'].includes(name)) {
    const sub = args.find((arg) => !isFlag(arg));
    if ((name === 'cargo' || name === 'go') && sub) {
      if (sub === 'test') return ran('Running tests', 'Ran tests', words);
      if (sub === 'build' || sub === 'check' || sub === 'vet') return ran('Building', 'Built', words);
      if (sub === 'run') return ran('Running program', 'Ran program', words);
      if (sub === 'fmt') return ran('Formatting', 'Formatted', words);
      if (sub === 'clippy') return ran('Linting', 'Linted', words);
    }
    if ((name === 'pip' || name === 'pip3') && sub === 'install') return ran('Installing dependencies', 'Installed dependencies', words);
    return describePackageManager(name, words);
  }
  if (name === 'npx' || name === 'pnpx' || name === 'bunx') return describeWords(args.filter((arg) => !isFlag(arg)));
  if (TEST_RUNNERS.has(name)) return ran('Running tests', 'Ran tests', words);
  if (name === 'tsc' || name === 'vue-tsc') return ran('Type-checking', 'Type-checked', words);
  if (LINTERS.has(name)) {
    if (name === 'ruff' && args[0] === 'format') return ran('Formatting', 'Formatted', words);
    return ran('Linting', 'Linted', words);
  }
  if (FORMATTERS.has(name)) return ran('Formatting', 'Formatted', words);
  if (name === 'vite' || name === 'webpack' || name === 'next' || name === 'esbuild') {
    return args[0] === 'build' ? ran('Building', 'Built', words) : ran('Starting dev server', 'Started dev server', words);
  }
  if (name === 'make' || name === 'just') {
    const target = args.find((arg) => !isFlag(arg) && !arg.includes('='));
    return target ? describeScript(target, words) : ran('Running make', 'Ran make', words);
  }
  if (name === 'python' || name === 'python3' || name === 'node' || name === 'deno' || name === 'ruby' || name === 'php') {
    if (args[0] === '-m' && args[1]) return describeWords(args.slice(1)) ?? ran('Running module', 'Ran module', words);
    if (args.includes('-c') || args.includes('-e') || args.includes('-')) return described('command', 'Running inline script', 'Ran inline script', name);
    const script = args.find((arg) => !isFlag(arg));
    return script ? described('command', 'Running script', 'Ran script', basename(script)) : null;
  }
  if (name === 'curl' || name === 'wget' || name === 'http') {
    const url = args.find((arg) => /^https?:\/\//.test(arg)) ?? operands(args, new Set(['-X', '-H', '-d', '-o', '--data', '--header', '-u'])).pop();
    return described('command', 'Requesting', 'Requested', url ?? null);
  }
  if (name === 'docker' || name === 'docker-compose' || name === 'podman') return ran('Running docker', 'Ran docker', words);
  if (name === 'mkdir') return described('command', 'Creating directory', 'Created directory', operands(args).join(', ') || null);
  if (name === 'touch') return described('command', 'Creating file', 'Created file', operands(args).map(basename).join(', ') || null);
  if (name === 'rm' || name === 'rmdir') return described('command', 'Removing', 'Removed', operands(args).join(', ') || null);
  if (name === 'mv') return described('command', 'Moving', 'Moved', operands(args).join(' → ') || null);
  if (name === 'cp') return described('command', 'Copying', 'Copied', operands(args).join(' → ') || null);
  if (name === 'chmod' || name === 'chown') return ran('Changing permissions', 'Changed permissions', words);
  if (name === 'kill' || name === 'pkill' || name === 'killall') return ran('Stopping process', 'Stopped process', words);
  if (name === 'sleep') return described('command', 'Waiting', 'Waited', args[0] ? `${args[0]}s` : null);
  return null;
};

const WRITERS = new Set(['cat', 'echo', 'printf']);

/** Output sent into a file (`cat > a.tsx <<EOF`, `echo x >> .gitignore`, `… | tee log`) is a write. */
const describeSimple = ({ words: input, writes }: SimpleCommand): Described | null => {
  const words = strip(input);
  const name = words[0] ? basename(words[0]) : '';
  const files = name === 'tee' ? operands(words.slice(1)) : writes;
  if (files.length && (!words.length || WRITERS.has(name) || name === 'tee')) {
    return described('edit', 'Writing', 'Wrote', files.map(basename).join(', '), files[0]);
  }
  if (!words.length) return null;
  return describeWords(words) ?? ran('Running', 'Ran', words);
};

/** A line that chains several commands reads as the chain of what each one does; `cd x && npm test`
 * is still just about the tests, and `… | tail -5` only trims the output. */
export const describeLine = (line: string): Omit<CommandDescription, 'display'> | null => {
  const commands = splitCommands(line).filter((command) => !command.piped || command.writes.length
    || basename(strip(command.words)[0] ?? '') === 'tee');
  const meaningful = commands.filter((command) => !NOISE.has(basename(strip(command.words)[0] ?? '')) || command.writes.length);
  const parts = (meaningful.length ? meaningful : commands.slice(0, 1)).map(describeSimple).filter((part): part is Described => part !== null);
  if (parts.length <= 1) return parts[0] ? { kind: parts[0].kind, active: parts[0].active, done: parts[0].done,
    detail: parts[0].detail, target: parts[0].target, steps: [] } : null;
  const steps = parts.map(({ active, done, detail }) => ({ active, done, detail }));
  return {
    kind: 'command',
    active: `Running ${parts.length} commands`,
    done: `Ran ${parts.length} commands`,
    detail: parts.map((part) => part.detail && !part.raw ? `${part.done} ${part.detail}` : part.done).join(' · '),
    target: null,
    steps,
  };
};
