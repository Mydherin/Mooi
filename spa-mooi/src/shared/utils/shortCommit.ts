export const shortCommit = (commit: string | null): string => (commit ? commit.slice(0, 7) : '—');
