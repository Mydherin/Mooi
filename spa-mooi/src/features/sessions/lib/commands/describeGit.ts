import { described, isFlag, operands, ran } from './commandWords';
import { describeSearch } from './describeFileCommands';

const GIT_VERBS: Record<string, [string, string]> = {
  status: ['Checking git status', 'Checked git status'],
  diff: ['Reviewing changes', 'Reviewed changes'],
  log: ['Reading git history', 'Read git history'],
  show: ['Inspecting commit', 'Inspected commit'],
  blame: ['Reading blame', 'Read blame'],
  branch: ['Checking branches', 'Checked branches'],
  add: ['Staging changes', 'Staged changes'],
  commit: ['Committing', 'Committed'],
  push: ['Pushing', 'Pushed'],
  pull: ['Pulling', 'Pulled'],
  fetch: ['Fetching', 'Fetched'],
  checkout: ['Switching branch', 'Switched branch'],
  switch: ['Switching branch', 'Switched branch'],
  merge: ['Merging', 'Merged'],
  rebase: ['Rebasing', 'Rebased'],
  stash: ['Stashing changes', 'Stashed changes'],
  restore: ['Restoring files', 'Restored files'],
  reset: ['Resetting', 'Reset'],
  clone: ['Cloning', 'Cloned'],
};

export const describeGit = (words: string[]) => {
  let index = 1;
  // `git -C dir status`: global options come before the subcommand.
  while (index < words.length && isFlag(words[index])) index += ['-C', '-c', '--git-dir', '--work-tree'].includes(words[index]) ? 2 : 1;
  const sub = words[index];
  const args = words.slice(index + 1);
  if (sub === 'grep') return describeSearch(args);
  if (sub === 'ls-files') return described('list', 'Listing tracked files', 'Listed tracked files', operands(args).join(', ') || null);
  const verb = sub ? GIT_VERBS[sub] : undefined;
  if (!verb) return null;
  return ran(verb[0], verb[1], ['git', ...words.slice(index)]);
};
