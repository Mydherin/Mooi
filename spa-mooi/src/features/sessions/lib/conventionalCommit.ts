/** The Conventional Commits types the server accepts (`mic_sessions.shared.conventional_commits`). */
export const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] as const;

const TITLE = new RegExp(`^(?:${COMMIT_TYPES.join('|')})(?:\\([^()\\s][^()]*\\))?!?: \\S`);

/** Mirrors the server check, so the dialog explains a rejected title before sending it. */
export const isConventionalCommit = (title: string): boolean => TITLE.test(title);
