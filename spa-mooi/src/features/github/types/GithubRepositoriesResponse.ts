import type { GithubRepository } from '@/features/github/types/GithubRepository';

export interface GithubRepositoriesResponse {
  repositories: GithubRepository[];
  installations: number;
}
