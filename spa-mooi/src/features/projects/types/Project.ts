/**
 * A GitHub repository the player added to their workspace.
 *
 * Light metadata only, exactly as it is persisted: the repository stays on GitHub, and Mooi keeps
 * just enough of it to show a card and reach the real thing.
 */
export interface Project {
  id: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string | null;
  htmlUrl: string | null;
  language: string | null;
  stars: number;
  addedAt: string;
}
