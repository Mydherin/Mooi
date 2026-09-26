/**
 * A GitHub repository the player added to their workspace.
 *
 * Light metadata only, exactly as it is persisted: the repository stays on GitHub, and Mooi keeps
 * just enough of it to show a card and reach the real thing. `webApplication` is the exception:
 * the player's own answer, which decides whether sessions offer deploy and preview.
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
  webApplication: boolean;
  addedAt: string;
}
