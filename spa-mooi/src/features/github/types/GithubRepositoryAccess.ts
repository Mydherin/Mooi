import type { GithubRepository } from '@/features/github/types/GithubRepository';

/**
 * The repositories a link can reach, and the number of GitHub App installations behind them.
 *
 * Zero installations is the whole reason a private repository can be missing from an otherwise
 * healthy connection: the player authorized Mooi, but never granted it a repository.
 */
export interface GithubRepositoryAccess {
  repositories: GithubRepository[];
  installations: number;
}
